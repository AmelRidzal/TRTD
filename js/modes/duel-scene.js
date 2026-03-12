// ================================================================
//  duel-scene.js  —  1v1 Duel game mode (client)
//
//  Rendering only — all physics run server-side at 30 Hz.
//  This scene sends inputs and lerps sprites to received positions.
// ================================================================

class DuelScene extends Phaser.Scene {
  constructor() { super({ key: 'DuelScene' }); }

  // preload() must exist so Phaser's boot sequence completes cleanly
  preload() {}

  create() {
    // duelSocket / duelPlayerIndex are globals set in state.js / ui.js
    this.socket     = duelSocket;
    this.myIndex    = duelPlayerIndex;
    this.enemyIndex = this.myIndex === 0 ? 1 : 0;

    this.dead      = false;
    this.mouseX    = MAP_W / 2;
    this.mouseY    = MAP_H / 2;
    this.fireHeld  = false;
    this.particles = [];
    this.serverState = null;

    // ── Build the visual world ────────────────────────────────
    makeTextures(this);
    this._buildMap();
    this._buildSprites();
    this._setupInput();
    this.crosshairGfx = this.add.graphics().setDepth(60);

    // ── Wire the socket to this scene ────────────────────────
    // The socket may still have ui.js's handler on it — replace it.
    if (this.socket) {
      this.socket.onmessage = (evt) => {
        let msg; try { msg = JSON.parse(evt.data); } catch { return; }
        this._onServerMessage(msg);
      };
      this.socket.onclose = () => {
        if (!this.dead) this._forfeit();
      };
    } else {
      // No socket — probably testing locally; show error after short delay
      this.time.delayedCall(500, () => {
        alert('No server connection. Return to menu.');
        showScreen('screen-main');
      });
      return;
    }

    // Send inputs to server at 30 Hz
    this._inputInterval = setInterval(() => this._sendInput(), 33);

    // Debug: log that scene started
    console.log('[DuelScene] started, playerIndex =', this.myIndex);
  }

  // ── Map (visual only — server does all physics) ───────────────
  _buildMap() {
    // Floor tiles
    for (let x = 0; x < MAP_W; x += 40)
      for (let y = 0; y < MAP_H; y += 40)
        this.add.image(x + 20, y + 20, 'floor').setDepth(0);

    // Wall tiles (static group for visuals; server handles collisions)
    const wallPts = [
      ...this._borderTiles(),
      [200,160],[200,200],[200,240],[200,360],[200,400],[200,440],
      [700,160],[700,200],[700,240],[700,360],[700,400],[700,440],
      [360,240],[400,240],[440,240],
      [360,360],[400,360],[440,360],
      [360,300],[440,300],
      [120,280],[120,320],
      [780,280],[780,320],
      [280,120],[320,120],[560,120],[600,120],
      [280,480],[320,480],[560,480],[600,480],
    ];
    for (const [cx, cy] of wallPts)
      this.add.image(cx, cy, 'wall').setDepth(1);
  }

  _borderTiles() {
    const pts = [];
    for (let x = 20; x < MAP_W; x += 40) { pts.push([x, 20]); pts.push([x, MAP_H - 20]); }
    for (let y = 60; y < MAP_H - 40; y += 40) { pts.push([20, y]); pts.push([MAP_W - 20, y]); }
    return pts;
  }

  // ── Sprites ───────────────────────────────────────────────────
  _buildSprites() {
    const mySpawn    = this.myIndex === 0 ? { x: 180, y: 300 } : { x: 720, y: 300 };
    const enemySpawn = this.myIndex === 0 ? { x: 720, y: 300 } : { x: 180, y: 300 };

    this.myTank = {
      body:   this.add.sprite(mySpawn.x,    mySpawn.y,    'pbody').setDepth(3),
      turret: this.add.sprite(mySpawn.x,    mySpawn.y,    'pturret').setDepth(5),
    };
    this.enemyTank = {
      body:   this.add.sprite(enemySpawn.x, enemySpawn.y, 'ebody').setDepth(3),
      turret: this.add.sprite(enemySpawn.x, enemySpawn.y, 'eturret').setDepth(5),
    };

    // HP bars (positioned in update)
    this.myHpBg  = this.add.rectangle(0, 0, 40, 5, 0x002233).setDepth(8);
    this.myHpBar = this.add.rectangle(0, 0, 40, 5, 0x00e5ff).setDepth(9).setOrigin(0, 0.5);
    this.enHpBg  = this.add.rectangle(0, 0, 40, 5, 0x2a0008).setDepth(8);
    this.enHpBar = this.add.rectangle(0, 0, 40, 5, 0xff3355).setDepth(9).setOrigin(0, 0.5);

    this.bulletSprites = new Map();
  }

  // ── Input ─────────────────────────────────────────────────────
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
    this.input.on('pointerup',   ()  => { this.fireHeld = false; });
  }

  _sendInput() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.dead) return;
    const k  = this.keys;
    const dx = this.mouseX - this.myTank.body.x;
    const dy = this.mouseY - this.myTank.body.y;
    const turretAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90;
    this.socket.send(JSON.stringify({
      type: 'input',
      input: {
        up:    k.up.isDown,
        down:  k.down.isDown,
        left:  k.left.isDown,
        right: k.right.isDown,
        fire:  this.fireHeld,
        turretAngle,
      },
    }));
  }

  // ── Server messages ───────────────────────────────────────────
  _onServerMessage(msg) {
    switch (msg.type) {
      case 'state':
        this.serverState = msg;
        break;
      case 'game_over':
        this.dead = true;
        clearInterval(this._inputInterval);
        this.time.delayedCall(700, () => showDuelResult(msg.winner === this.myIndex));
        break;
      case 'opponent_disconnected':
        this._forfeit();
        break;
      case 'rematch_request':
      case 'rematch_start':
        // Hand off to ui.js — it owns the rematch flow
        _handleRematchMessage(msg.type);
        break;
    }
  }

  _forfeit() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this._inputInterval);
    this.time.delayedCall(300, () => showDuelResult(true, true));
  }

  // ── Update (60 fps) ───────────────────────────────────────────
  update(time, delta) {
    if (!this.serverState) return;
    const dt = delta / 1000;

    const myData    = this.serverState.players[this.myIndex];
    const enemyData = this.serverState.players[this.enemyIndex];

    this._lerpTank(this.myTank,    myData,    0.35);
    this._lerpTank(this.enemyTank, enemyData, 0.35);
    this._updateHpBar(this.myHpBar,  this.myHpBg,  this.myTank,    myData.hp);
    this._updateHpBar(this.enHpBar,  this.enHpBg,  this.enemyTank, enemyData.hp);

    hudHp = myData.hp;
    refreshHUD();

    this._syncBullets(this.serverState.bullets);
    this._tickParticles(dt);
    this._drawCrosshair();
  }

  // ── Lerp ──────────────────────────────────────────────────────
  _lerpTank(tank, data, t) {
    if (!data || !data.alive) {
      tank.body.setVisible(false);
      tank.turret.setVisible(false);
      return;
    }
    tank.body.setVisible(true);
    tank.turret.setVisible(true);
    tank.body.x = Phaser.Math.Linear(tank.body.x, data.x, t);
    tank.body.y = Phaser.Math.Linear(tank.body.y, data.y, t);
    tank.turret.setPosition(tank.body.x, tank.body.y);
    tank.body.angle   = data.angle;
    tank.turret.angle = data.turretAngle;
  }

  _updateHpBar(bar, bg, tank, hp) {
    const pct = Math.max(0, hp / 100);
    const W   = 40;
    const bx  = tank.body.x - W / 2;
    const by  = tank.body.y - 30;
    bg.setPosition(tank.body.x, by);
    bar.setPosition(bx, by);
    bar.displayWidth = W * pct;
    bar.displayHeight = 5;
  }

  // ── Bullets ───────────────────────────────────────────────────
  _syncBullets(bullets) {
    const activeIds = new Set(bullets.map(b => b.id));

    for (const [id, gfx] of this.bulletSprites) {
      if (!activeIds.has(id)) {
        this._spawnParticles(gfx.x, gfx.y, id % 2 === 0 ? 0x00e5ff : 0xff3355, 4);
        gfx.destroy();
        this.bulletSprites.delete(id);
      }
    }

    for (const b of bullets) {
      let gfx = this.bulletSprites.get(b.id);
      if (!gfx) {
        gfx = this.add.graphics().setDepth(6);
        const col = b.ownerIndex === this.myIndex ? 0x00e5ff : 0xff3355;
        gfx.fillStyle(col); gfx.fillCircle(0, 0, 5);
        gfx.fillStyle(0xffffff, 0.7); gfx.fillCircle(-2, -2, 2);
        this.bulletSprites.set(b.id, gfx);
      }
      gfx.setPosition(b.x, b.y);
    }
  }

  // ── Particles ─────────────────────────────────────────────────
  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 160;
      const gfx = this.add.graphics().setDepth(9);
      gfx.fillStyle(color); gfx.fillCircle(0, 0, 2 + Math.random() * 3);
      this.particles.push({ gfx, x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1 });
    }
  }

  _tickParticles(dt) {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.87; p.vy *= 0.87;
      p.life -= dt * 2.5;
      p.gfx.x = p.x; p.gfx.y = p.y;
      p.gfx.alpha = Math.max(0, p.life);
      if (p.life <= 0) { p.gfx.destroy(); return false; }
      return true;
    });
  }

  // ── Crosshair ─────────────────────────────────────────────────
  _drawCrosshair() {
    const x = this.mouseX, y = this.mouseY;
    const g = this.crosshairGfx; g.clear();
    g.lineStyle(1.5, 0x00e5ff, 0.85);
    const s = 11, gap = 5;
    [[x-s-gap,y,x-gap,y],[x+gap,y,x+s+gap,y],
     [x,y-s-gap,x,y-gap],[x,y+gap,x,y+s+gap]].forEach(([x1,y1,x2,y2]) => {
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    });
    g.strokeCircle(x, y, 5);
    g.fillStyle(0x00e5ff, 0.4); g.fillCircle(x, y, 1.5);
  }

  // ── Cleanup ───────────────────────────────────────────────────
  shutdown() {
    clearInterval(this._inputInterval);
    if (this.socket) { this.socket.onmessage = null; this.socket.onclose = null; }
    for (const gfx of this.bulletSprites.values()) gfx.destroy();
    this.bulletSprites.clear();
  }
}
