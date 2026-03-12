// ================================================================
//  modes/wave-scene.js  —  Wave Clear game mode
//
//  This Phaser Scene handles all Wave Clear gameplay.
//  It reads config from:
//    - DIFFS[activeDiff]   (constants.js / state.js)
//    - activeMap.build()   (whichever map is selected)
//
//  To add a new game mode:
//    1. Copy this file, rename it (e.g. duel-scene.js)
//    2. Change the scene key: super({ key: 'DuelScene' })
//    3. Implement your own create() / update() logic
//    4. Add a <script> tag for it in index.html (before main.js)
//    5. Register the scene in phaserCfg inside main.js
// ================================================================

class WaveScene extends Phaser.Scene {
  constructor() { super({ key: 'WaveScene' }); }

  // ── Lifecycle ─────────────────────────────────────────────────
  create() {
    this.cfg    = DIFFS[activeDiff];
    this.hp     = MAX_HP;
    this.wave   = 1;
    this.score  = 0;
    this.kills  = 0;
    this.dead   = false;

    // Wave spawn state
    this.waveActive  = false;
    this.waveTotal   = 0;
    this.waveSpawned = 0;
    this.waveAlive   = 0;
    this.nextSpawn   = 0;

    // Runtime lists
    this.enemies   = [];
    this.eBullets  = [];
    this.particles = [];

    // Input state
    this.lastFire = 0;
    this.mouseX   = MAP_W / 2;
    this.mouseY   = MAP_H / 2;
    this.fireHeld = false;

    // Build textures, map, player, then start
    makeTextures(this);
    this.walls = activeMap.build(this);  // map returns its wall group
    this._spawnPlayer();
    this._setupColliders();
    this._setupInput();

    this.crosshairGfx = this.add.graphics().setDepth(60);
    this._startCountdown();
  }

  // ================================================================
  //  PLAYER
  // ================================================================

  _spawnPlayer() {
    const b = this.physics.add.sprite(450, 300, 'pbody');
    b.setCollideWorldBounds(true).setDepth(3);
    b.setCircle(15, 6, 8);
    const t = this.add.sprite(450, 300, 'pturret').setDepth(5);
    this.player = { body: b, turret: t, turretAngle: 0 };
    this.pBullets = this.physics.add.group();
  }

  _setupColliders() {
    this.physics.add.collider(this.player.body, this.walls);
    this.physics.add.collider(this.pBullets, this.walls, (b) => {
      this._spawnParticles(b.x, b.y, 0x00e5ff, 6);
      b.destroy();
    });
  }

  _setupInput() {
    const kb = this.input.keyboard;
    this.keys = {
      up:    kb.addKey('W'),
      down:  kb.addKey('S'),
      left:  kb.addKey('A'),
      right: kb.addKey('D'),
    };
    this.input.on('pointermove', p => { this.mouseX = p.x; this.mouseY = p.y; });
    this.input.on('pointerdown', p => { if (p.leftButtonDown()) this.fireHeld = true; });
    this.input.on('pointerup',   ()  => this.fireHeld = false);
  }

  // ================================================================
  //  WAVE SYSTEM
  // ================================================================

  _startCountdown() {
    this.waveActive  = false;
    this.waveTotal   = Math.floor(this.cfg.waveBase + (this.wave - 1) * this.cfg.waveGrow * 2);
    this.waveSpawned = 0;
    this.waveAlive   = this.waveTotal;
    hudWave = this.wave; refreshHUD();

    const banner = this._makeBanner(`WAVE  ${this.wave}`, 44, '#ffffff');
    this.tweens.add({ targets: banner, alpha: 1, duration: 300 });
    this.tweens.add({
      targets: banner, alpha: 0, duration: 400, delay: 1100,
      onComplete: () => {
        banner.destroy();
        this.waveActive = true;
        this.nextSpawn  = this.time.now + 200;
      },
    });
  }

  /** Centred, depth-40, initially invisible banner text. */
  _makeBanner(str, size, color) {
    return this.add.text(MAP_W / 2, MAP_H / 2, str, {
      fontFamily: 'Orbitron', fontSize: `${size}px`, fontStyle: 'bold',
      color, stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(40).setAlpha(0);
  }

  _spawnEnemy() {
    // Pick a random edge to spawn on
    const side = Phaser.Math.Between(0, 3);
    let x, y;
    if      (side === 0) { x = Phaser.Math.Between(60, MAP_W - 60); y = 60; }
    else if (side === 1) { x = Phaser.Math.Between(60, MAP_W - 60); y = MAP_H - 60; }
    else if (side === 2) { x = 60;         y = Phaser.Math.Between(60, MAP_H - 60); }
    else                 { x = MAP_W - 60; y = Phaser.Math.Between(60, MAP_H - 60); }

    // Stats scale with wave number
    const hp  = Math.floor(this.cfg.enemyHp    + this.wave * 7);
    const spd = Math.floor(this.cfg.enemySpeed  + this.wave * 4);
    const cd  = Math.max(450, this.cfg.fireCd   - this.wave * 20);

    const body   = this.physics.add.sprite(x, y, 'ebody').setDepth(3);
    const turret = this.add.sprite(x, y, 'eturret').setDepth(5);
    body.setCollideWorldBounds(true);
    body.setCircle(13, 7, 8);

    // Floating HP bar
    const bgBar = this.add.rectangle(x, y - 26, 34, 5, 0x2a0008).setDepth(6);
    const hpBar = this.add.rectangle(x, y - 26, 34, 5, 0xff3355).setDepth(7);

    const e = { body, turret, hp, maxHp: hp, speed: spd, fireCd: cd, lastFire: 0, hpBar, bgBar };

    // Per-enemy colliders
    this.physics.add.collider(body, this.walls);
    this.physics.add.overlap(this.pBullets, body, (_body, bullet) => {
      bullet.destroy();
      this._spawnParticles(bullet.x, bullet.y, 0xff3355, 8);
      e.hp -= BULLET_DMG_TO_ENEMY;
      this._updateEnemyBar(e);
      if (e.hp <= 0) this._killEnemy(e);
    });

    this.enemies.push(e);
    this.waveSpawned++;
  }

  _updateEnemyBar(e) {
    const pct = Math.max(0, e.hp / e.maxHp);
    e.hpBar.scaleX = pct;
    e.hpBar.x = e.body.x - 17 + (34 * pct) / 2;
    e.hpBar.y = e.body.y - 26;
    e.bgBar.setPosition(e.body.x, e.body.y - 26);
  }

  _killEnemy(e) {
    if (!e.body.active) return;
    this._spawnParticles(e.body.x, e.body.y, 0xff3355, 22);
    this._screenFlash(0xff1030, 0.07);
    e.body.destroy(); e.turret.destroy(); e.hpBar.destroy(); e.bgBar.destroy();
    this.enemies = this.enemies.filter(x => x !== e);

    this.kills++;
    this.score += 100 + this.wave * 25;
    hudKills = this.kills; hudScore = this.score; refreshHUD();

    this.waveAlive--;
    if (this.waveAlive <= 0 && this.waveSpawned >= this.waveTotal)
      this._waveComplete();
  }

  _waveComplete() {
    this.waveActive = false;
    const heal = 25;
    this.hp = Math.min(MAX_HP, this.hp + heal);
    hudHp = this.hp; refreshHUD();

    const b1 = this._makeBanner(`WAVE ${this.wave} CLEARED!`, 32, '#00e5ff');
    const b2 = this._makeBanner(`+${heal} HP RESTORED`, 15, '#00ff88');
    b2.y += 44;
    this.tweens.add({ targets: [b1, b2], alpha: 1, duration: 300 });
    this.tweens.add({
      targets: [b1, b2], alpha: 0, duration: 400, delay: 1400,
      onComplete: () => { b1.destroy(); b2.destroy(); this.wave++; this._startCountdown(); },
    });
  }

  // ================================================================
  //  SHOOTING
  // ================================================================

  _shootPlayer() {
    const now = this.time.now;
    if (now - this.lastFire < FIRE_COOLDOWN) return;
    this.lastFire = now;

    const ang = Phaser.Math.DegToRad(this.player.turretAngle - 90);
    const ox = Math.cos(ang) * 24, oy = Math.sin(ang) * 24;
    const bx = this.player.body.x + ox, by = this.player.body.y + oy;

    const b = this.pBullets.create(bx, by, 'pbullet');
    if (!b) return;
    b.setDepth(4).setCircle(5);
    b.setVelocity(Math.cos(ang) * BULLET_SPEED, Math.sin(ang) * BULLET_SPEED);
    b.body.allowGravity = false;
    this.time.delayedCall(2300, () => { if (b.active) b.destroy(); });

    // Muzzle flash
    const fl = this.add.circle(bx, by, 10, 0x00e5ff, 0.9).setDepth(6);
    this.tweens.add({ targets: fl, scaleX: 3, scaleY: 3, alpha: 0, duration: 110, onComplete: () => fl.destroy() });
  }

  _shootEnemy(e) {
    const ang = Phaser.Math.DegToRad(e.turretAngle - 90);
    const ox = Math.cos(ang) * 16, oy = Math.sin(ang) * 16;
    const img = this.physics.add.image(e.body.x + ox, e.body.y + oy, 'ebullet').setDepth(4);
    img.setVelocity(Math.cos(ang) * BULLET_SPEED * 0.72, Math.sin(ang) * BULLET_SPEED * 0.72);
    img.body.allowGravity = false;
    this.eBullets.push(img);
    this.time.delayedCall(2200, () => {
      if (img.active) { img.destroy(); this.eBullets = this.eBullets.filter(x => x !== img); }
    });
  }

  // ================================================================
  //  EFFECTS
  // ================================================================

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 70 + Math.random() * 200;
      const gfx = this.add.graphics().setDepth(9);
      gfx.fillStyle(color); gfx.fillCircle(0, 0, 2 + Math.random() * 4);
      this.particles.push({ gfx, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 });
    }
  }

  _screenFlash(color, alpha) {
    const fl = this.add.rectangle(MAP_W / 2, MAP_H / 2, MAP_W, MAP_H, color, alpha).setDepth(30);
    this.tweens.add({ targets: fl, alpha: 0, duration: 160, onComplete: () => fl.destroy() });
  }

  // ================================================================
  //  UPDATE LOOP
  // ================================================================
  update(time, delta) {
    if (this.dead) return;
    const dt = delta / 1000;

    this._movePlayer();
    this._aimTurret();
    if (this.fireHeld) this._shootPlayer();

    if (this.waveActive) {
      if (this.waveSpawned < this.waveTotal && time > this.nextSpawn) {
        this._spawnEnemy();
        this.nextSpawn = time + this.cfg.spawnInterval;
      }
      for (const e of this.enemies) this._updateEnemy(e, time);
      this._resolveEnemyBullets();
    }

    this._tickParticles(dt);
    this._drawCrosshair();
  }

  // ── Player movement ──────────────────────────────────────────

  _movePlayer() {
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.left.isDown)  dx = -1; else if (k.right.isDown) dx = 1;
    if (k.up.isDown)    dy = -1; else if (k.down.isDown)  dy = 1;

    if (dx || dy) {
      const a = Math.atan2(dy, dx);
      this.player.body.setVelocity(Math.cos(a) * PLAYER_SPEED, Math.sin(a) * PLAYER_SPEED);
      this.player.body.angle = Phaser.Math.RadToDeg(a) + 90;
    } else {
      this.player.body.setVelocity(0, 0);
    }
    this.player.turret.setPosition(this.player.body.x, this.player.body.y);
  }

  _aimTurret() {
    const dx = this.mouseX - this.player.body.x;
    const dy = this.mouseY - this.player.body.y;
    this.player.turretAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90;
    this.player.turret.angle = this.player.turretAngle;
  }

  // ── Enemy AI ─────────────────────────────────────────────────

  _updateEnemy(e, time) {
    if (!e.body.active) return;
    const px = this.player.body.x, py = this.player.body.y;
    const dx = px - e.body.x,      dy = py - e.body.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ang  = Math.atan2(dy, dx);

    // Chase but keep a comfortable gap
    if      (dist > 90) e.body.setVelocity( Math.cos(ang) * e.speed,        Math.sin(ang) * e.speed);
    else if (dist < 60) e.body.setVelocity(-Math.cos(ang) * e.speed * 0.5, -Math.sin(ang) * e.speed * 0.5);
    else                e.body.setVelocity(0, 0);

    e.body.angle   = Phaser.Math.RadToDeg(ang) + 90;
    e.turretAngle  = Phaser.Math.RadToDeg(ang) + 90;
    e.turret.angle = e.turretAngle;
    e.turret.setPosition(e.body.x, e.body.y);
    this._updateEnemyBar(e);

    if (dist < 400 && time - e.lastFire > e.fireCd) {
      e.lastFire = time;
      this._shootEnemy(e);
    }
  }

  _resolveEnemyBullets() {
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      if (!b.active) { this.eBullets.splice(i, 1); continue; }

      // Wall check
      let hitWall = false;
      this.walls.getChildren().forEach(w => {
        if (!hitWall && Phaser.Geom.Intersects.RectangleToRectangle(b.getBounds(), w.getBounds()))
          hitWall = true;
      });
      if (hitWall) {
        this._spawnParticles(b.x, b.y, 0xff3355, 5);
        b.destroy(); this.eBullets.splice(i, 1); continue;
      }

      // Player check
      const dx = b.x - this.player.body.x;
      const dy = b.y - this.player.body.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        this._spawnParticles(b.x, b.y, 0x00e5ff, 8);
        b.destroy(); this.eBullets.splice(i, 1);
        this._hurtPlayer(this.cfg.enemyDmg);
      }
    }
  }

  _hurtPlayer(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    hudHp = this.hp; refreshHUD();
    this._screenFlash(0xff0000, 0.2);
    this.cameras.main.shake(130, 0.008);
    this.tweens.add({
      targets: [this.player.body, this.player.turret],
      alpha: 0.1, yoyo: true, duration: 55, repeat: 3,
      onComplete: () => { this.player.body.alpha = 1; this.player.turret.alpha = 1; },
    });

    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this._spawnParticles(this.player.body.x, this.player.body.y, 0x00e5ff, 35);
      this.player.body.setVisible(false);
      this.player.turret.setVisible(false);
      this.time.delayedCall(900, () => {
        hudScore = this.score; hudKills = this.kills; hudWave = this.wave;
        showResult(false);
      });
    }
  }

  // ── Particles ────────────────────────────────────────────────

  _tickParticles(dt) {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.87; p.vy *= 0.87;
      p.life -= dt * 2.2;
      p.gfx.x = p.x; p.gfx.y = p.y; p.gfx.alpha = Math.max(0, p.life);
      if (p.life <= 0) { p.gfx.destroy(); return false; }
      return true;
    });
  }

  // ── Crosshair ────────────────────────────────────────────────

  _drawCrosshair() {
    const x = this.mouseX, y = this.mouseY;
    const g = this.crosshairGfx;
    g.clear();
    g.lineStyle(1.5, 0x00e5ff, 0.85);

    const s = 11, gap = 5;
    [
      [x - s - gap, y, x - gap,     y],
      [x + gap,     y, x + s + gap, y],
      [x, y - s - gap, x, y - gap    ],
      [x, y + gap,     x, y + s + gap],
    ].forEach(([x1, y1, x2, y2]) => {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    });
    g.strokeCircle(x, y, 5);
    g.fillStyle(0x00e5ff, 0.4); g.fillCircle(x, y, 1.5);
  }
}
