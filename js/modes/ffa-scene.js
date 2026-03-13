// ================================================================
//  ffa-scene.js  —  Free-For-All Phaser scene
// ================================================================

const PLAYER_COLS = [
  0x00e5ff, // 0 cyan  (you)
  0xff4060, // 1 red
  0x44ff88, // 2 green
  0xffaa00, // 3 orange
  0xaa44ff, // 4 purple
  0xff44cc, // 5 pink
  0xffff44, // 6 yellow
  0x44aaff, // 7 sky-blue
];

class FFAScene extends Phaser.Scene {
  constructor() { super({ key: 'FFAScene' }); }
  preload() {}

  create() {
    this.myIdx    = duelPlayerIndex;
    this.sock     = duelSocket;
    this.state    = null;
    this.fireHeld = false;
    this.pSprites = {};
    this.bSprites = new Map();
    this.parts    = [];
    this.isOver   = false;

    // Raw Phaser-canvas pointer coords (NOT CSS-scaled coords)
    this.ptrX = this.scale.width  / 2;
    this.ptrY = this.scale.height / 2;

    this.physics.world.setBounds(0, 0, MAP_FFA.width, MAP_FFA.height);

    makeTextures(this);
    this.walls = MAP_FFA.build(this);

    // ── Camera ───────────────────────────────────────────────────
    // setBounds lets Phaser clamp scrollX/Y automatically at edges
    this.cameras.main.setZoom(1.5);
    this.cameras.main.centerOn(MAP_FFA.width / 2, MAP_FFA.height / 2);

    this._buildHUD();
    this._setupInput();

    this.xhairGfx = this.add.graphics().setDepth(80).setScrollFactor(0);

    // ── Socket ───────────────────────────────────────────────────
    if (this.sock) {
      this.sock.onmessage = evt => {
        let m; try { m = JSON.parse(evt.data); } catch { return; }
        this._onMsg(m);
      };
      this.sock.onclose = () => { if (!this.isOver) showFFAResult(null, true); };

      // Drain any messages that arrived between _launchFFAGame() and create()
      if (window._ffaMsgQueue) {
        window._ffaMsgQueue.forEach(m => this._onMsg(m));
        window._ffaMsgQueue = null;
      }
    }

    this._inputTick = setInterval(() => this._sendInput(), 33);
    this.time.delayedCall(80, () => applyScale());
  }

  // ── HUD ─────────────────────────────────────────────────────────
  _buildHUD() {
    const sw = this.scale.width, sh = this.scale.height;

    this.timerTxt = this.add.text(sw / 2, 10, '5:00', {
      fontFamily: 'Orbitron', fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(90);

    this.lbTxt = Array.from({ length: 8 }, (_, i) =>
      this.add.text(sw - 8, 8 + i * 16, '', {
        fontFamily: 'Share Tech Mono', fontSize: '10px',
        color: '#aaaaaa', stroke: '#000', strokeThickness: 3,
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(90)
    );

    this.respTxt = this.add.text(sw / 2, sh / 2, '', {
      fontFamily: 'Orbitron', fontSize: '26px', fontStyle: 'bold',
      color: '#ff4060', stroke: '#000', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(95).setVisible(false);

    this.mmGfx = this.add.graphics().setScrollFactor(0).setDepth(92);

    const wz = this.add.text(sw / 2, sh / 2 - 50, 'WARZONE', {
      fontFamily: 'Orbitron', fontSize: '13px',
      color: '#00e5ff55', letterSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);
    this.time.delayedCall(3000, () => wz.setVisible(false));
  }

  // ── Input ────────────────────────────────────────────────────────
  _setupInput() {
    const kb = this.input.keyboard;
    this.keys = {
      up:    kb.addKey('W'),
      down:  kb.addKey('S'),
      left:  kb.addKey('A'),
      right: kb.addKey('D'),
    };

    // Store Phaser canvas-space pointer (p.x/p.y are already in canvas px,
    // unaffected by CSS transform — Phaser handles that internally).
    this.input.on('pointermove', p => {
      this.ptrX = p.x;
      this.ptrY = p.y;
    });
    this.input.on('pointerdown', p => { if (p.leftButtonDown()) this.fireHeld = true; });
    this.input.on('pointerup',   () => { this.fireHeld = false; });
  }

  // ── Server messages ─────────────────────────────────────────────
  _onMsg(m) {
    switch (m.type) {
      case 'ffa_state':
        this.state = m;
        break;
      case 'ffa_killed':
        this.respTxt.setText('DESTROYED\nRespawning…').setVisible(true);
        if (this.pSprites[this.myIdx]) {
          this.pSprites[this.myIdx].body.setVisible(false);
          this.pSprites[this.myIdx].turret.setVisible(false);
        }
        break;
      case 'ffa_respawned':
        this.respTxt.setVisible(false);
        if (this.pSprites[this.myIdx]) {
          this.pSprites[this.myIdx].body.setVisible(true);
          this.pSprites[this.myIdx].turret.setVisible(true);
        }
        break;
      case 'ffa_over':
        this.isOver = true;
        clearInterval(this._inputTick);
        this.time.delayedCall(500, () => showFFAResult(m.leaderboard, false));
        break;
      case 'ffa_disbanded':
        showFFAResult(null, true);
        break;
    }
  }

  // ── Input send ───────────────────────────────────────────────────
  _sendInput() {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;

    // ── Turret angle ─────────────────────────────────────────────
    // Camera is always centred on the tank, so the tank is always at
    // exactly (canvasW/2, canvasH/2) in Phaser canvas pixels.
    // Angle from canvas-centre to pointer = angle from tank to mouse.
    // No coordinate conversion needed — works regardless of CSS scale or zoom.
    const ptr  = this.input.activePointer;
    const cx   = this.scale.width  / 2;
    const cy   = this.scale.height / 2;
    const ta   = Phaser.Math.RadToDeg(Math.atan2(ptr.y - cy, ptr.x - cx)) + 90;

    this.sock.send(JSON.stringify({
      type: 'ffa_input',
      input: {
        up:    this.keys.up.isDown,
        down:  this.keys.down.isDown,
        left:  this.keys.left.isDown,
        right: this.keys.right.isDown,
        fire:  this.fireHeld,
        turretAngle: ta,
      },
    }));
  }

  // ── Update ───────────────────────────────────────────────────────
  update(_, delta) {
    if (!this.state) return;
    const st = this.state;

    for (const [iStr, pd] of Object.entries(st.players)) {
      this._syncSprite(parseInt(iStr), pd);
    }

    // ── Camera — hard-lock to sprite position every frame ────────
    const mySp = this.pSprites[this.myIdx];
    if (mySp?.body?.visible) {
      this.cameras.main.centerOn(mySp.body.x, mySp.body.y);
    }

    this._syncBullets(st.bullets || []);
    this._tickParts(delta / 1000);
    this._updateHUD(st);
    this._drawMinimap(st);
    this._drawCrosshair();
  }

  // ── Sprites ──────────────────────────────────────────────────────
  _syncSprite(idx, pd) {
    if (!this.pSprites[idx]) this._makeSprite(idx);
    const sp   = this.pSprites[idx];
    const isMe = idx === this.myIdx;
    const show = pd.alive && (!isMe || !this.respTxt.visible);

    sp.body.setVisible(show);
    sp.turret.setVisible(show);
    sp.hpBg.setVisible(pd.alive);
    sp.hpBar.setVisible(pd.alive);
    sp.tag.setVisible(pd.alive);
    if (!pd.alive) return;

    const t = 0.3;
    sp.body.x = Phaser.Math.Linear(sp.body.x, pd.x, t);
    sp.body.y = Phaser.Math.Linear(sp.body.y, pd.y, t);
    sp.body.angle   = pd.angle;
    sp.turret.setPosition(sp.body.x, sp.body.y);
    sp.turret.angle = pd.turretAngle;

    const BW  = 36;
    const pct = Math.max(0, pd.hp / 100);
    sp.hpBg.setPosition(sp.body.x, sp.body.y - 28);
    sp.hpBar.setPosition(sp.body.x - BW / 2, sp.body.y - 28);
    sp.hpBar.displayWidth = BW * pct;
    sp.tag.setPosition(sp.body.x, sp.body.y - 40);
    sp.tag.setText(`P${idx + 1}  ${pd.kills ?? 0}K`);
  }

  _makeSprite(idx) {
    const col  = PLAYER_COLS[idx] || 0xffffff;
    const isMe = idx === this.myIdx;
    const sp   = this.pSprites[idx] = {};

    sp.body   = this.add.sprite(0, 0, isMe ? 'pbody'   : 'ebody').setDepth(3);
    sp.turret = this.add.sprite(0, 0, isMe ? 'pturret' : 'eturret').setDepth(5);
    if (!isMe) { sp.body.setTint(col); sp.turret.setTint(col); }

    sp.hpBg  = this.add.rectangle(0, 0, 36, 4, 0x111122).setDepth(7);
    sp.hpBar = this.add.rectangle(0, 0, 36, 4, col).setDepth(8).setOrigin(0, 0.5);
    sp.tag   = this.add.text(0, 0, '', {
      fontFamily: 'Share Tech Mono', fontSize: '9px',
      color: '#' + col.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9);
  }

  // ── Bullets ──────────────────────────────────────────────────────
  _syncBullets(bullets) {
    const live = new Set(bullets.map(b => b.id));
    for (const [id, g] of this.bSprites) {
      if (!live.has(id)) {
        this._spawnParts(g.x, g.y, PLAYER_COLS[g._own] || 0xffffff, 3);
        g.destroy(); this.bSprites.delete(id);
      }
    }
    for (const b of bullets) {
      let g = this.bSprites.get(b.id);
      if (!g) {
        const c = PLAYER_COLS[b.owner] || 0xffffff;
        g = this.add.graphics().setDepth(6);
        g.fillStyle(c, 1); g.fillCircle(0, 0, 5);
        g.fillStyle(0xffffff, 0.4); g.fillCircle(-2, -2, 2);
        g._own = b.owner;
        this.bSprites.set(b.id, g);
      }
      g.setPosition(b.x, b.y);
    }
  }

  // ── Particles ────────────────────────────────────────────────────
  _spawnParts(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 120;
      const g = this.add.graphics().setDepth(9);
      g.fillStyle(col); g.fillCircle(0, 0, 2 + Math.random() * 3);
      this.parts.push({ g, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 });
    }
  }
  _tickParts(dt) {
    this.parts = this.parts.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.86; p.vy *= 0.86; p.life -= dt * 2.5;
      p.g.setPosition(p.x, p.y); p.g.alpha = Math.max(0, p.life);
      if (p.life <= 0) { p.g.destroy(); return false; }
      return true;
    });
  }

  // ── HUD ──────────────────────────────────────────────────────────
  _updateHUD(st) {
    const s = Math.max(0, Math.ceil(st.timeLeft || 0));
    this.timerTxt.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    this.timerTxt.setColor(s <= 30 ? '#ff4060' : '#ffffff');

    const sorted = Object.entries(st.players)
      .map(([i, p]) => ({ i: +i, k: p.kills || 0 }))
      .sort((a, b) => b.k - a.k);
    sorted.forEach(({ i, k }, rank) => {
      const lb = this.lbTxt[rank]; if (!lb) return;
      lb.setColor(i === this.myIdx ? '#ffffff'
        : '#' + (PLAYER_COLS[i] || 0xaaaaaa).toString(16).padStart(6, '0'));
      lb.setText(`${rank + 1}. P${i + 1}  ${k}K` + (i === this.myIdx ? ' ◄' : ''));
    });
    for (let i = sorted.length; i < 8; i++) this.lbTxt[i].setText('');

    const me = st.players[this.myIdx];
    if (me) { hudHp = me.hp; refreshHUD(); }
  }

  // ── Minimap ───────────────────────────────────────────────────────
  _drawMinimap(st) {
    const MW = 130, MH = 87, pad = 8;
    const sw = this.scale.width, sh = this.scale.height;
    const mx = sw - MW - pad, my = sh - MH - pad;
    const sx = MW / MAP_FFA.width, sy = MH / MAP_FFA.height;
    const g  = this.mmGfx; g.clear();

    g.fillStyle(0x000000, 0.7); g.fillRect(mx, my, MW, MH);
    g.lineStyle(1, 0x00e5ff, 0.3); g.strokeRect(mx, my, MW, MH);

    for (const r of MAP_FFA.walls) {
      const rw = Math.max(1, r.w * sx), rh = Math.max(1, r.h * sy);
      g.fillStyle(0x2828aa, 0.9);
      g.fillRect(mx + r.x * sx, my + r.y * sy, rw, rh);
    }

    for (const [iStr, p] of Object.entries(st.players)) {
      if (!p.alive) continue;
      const i = +iStr;
      g.fillStyle(PLAYER_COLS[i] || 0xffffff, 1);
      g.fillCircle(mx + p.x * sx, my + p.y * sy, i === this.myIdx ? 3.5 : 2.5);
    }

    // Camera viewport outline
    const cam = this.cameras.main;
    const vx  = mx + cam.scrollX * sx;
    const vy  = my + cam.scrollY * sy;
    const vw  = (this.scale.width  / cam.zoom) * sx;
    const vh  = (this.scale.height / cam.zoom) * sy;
    g.lineStyle(1, 0x00e5ff, 0.5); g.strokeRect(vx, vy, vw, vh);
  }

  // ── Crosshair ────────────────────────────────────────────────────
  _drawCrosshair() {
    const g = this.xhairGfx; g.clear();
    const x = this.ptrX, y = this.ptrY;
    g.lineStyle(1.5, 0x00e5ff, 0.85);
    [[x-14,y,x-4,y],[x+4,y,x+14,y],[x,y-14,x,y-4],[x,y+4,x,y+14]]
      .forEach(([x1,y1,x2,y2]) => { g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath(); });
    g.strokeCircle(x, y, 4);
  }

  // ── Cleanup ───────────────────────────────────────────────────────
  shutdown() {
    clearInterval(this._inputTick);
    if (this.sock) { this.sock.onmessage = null; this.sock.onclose = null; }
    for (const g of this.bSprites.values()) g.destroy();
    this.bSprites.clear();
  }
}
