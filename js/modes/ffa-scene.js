// ================================================================
//  ffa-scene.js  —  Free-For-All Phaser scene
// ================================================================

const PLAYER_COLS = [
  0x00e5ff, // 0 cyan
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

    // RTD state
    this.isRTD           = false; // set properly in first update() once ffaLobbyMode is confirmed
    this.canRoll         = false;
    this._diceAnimActive = false;
    this.rollPulseTween  = null;

    this.ptrX = this.scale.width  / 2;
    this.ptrY = this.scale.height / 2;

    this.physics.world.setBounds(0, 0, MAP_FFA.width, MAP_FFA.height);

    makeTextures(this);
    this.walls = MAP_FFA.build(this);

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

      if (window._ffaMsgQueue) {
        window._ffaMsgQueue.forEach(m => this._onMsg(m));
        window._ffaMsgQueue = null;
      }
    }

    this._inputTick = setInterval(() => this._sendInput(), 33);
    this.time.delayedCall(80, () => applyScale(MAP_FFA.width, MAP_FFA.height));

    // Pre-clear wave HUD elements so stale text from other modes doesn't show
    const _wt = document.getElementById('wave-title');
    const _wn = document.getElementById('wave-num');
    if (_wt) _wt.textContent = '';
    if (_wn) _wn.textContent = '';
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

    // ── RTD-only HUD elements ────────────────────────────────────
    if (this.isRTD) {
      this.add.text(8, 8, '🎲 RTD', {
        fontFamily: 'Share Tech Mono', fontSize: '9px',
        color: '#aa44ff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(90);

      // Pulsing "SPACE to roll" prompt at bottom
      this.rollPrompt = this.add.text(sw / 2, sh - 28, '[ Q ]  ROLL THE DICE  (10 pts)', {
        fontFamily: 'Orbitron', fontSize: '13px', fontStyle: 'bold',
        color: '#ffff44', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(95).setVisible(false);

      // Small active-effect label under the timer
      this.effectIndicator = this.add.text(sw / 2, 36, '', {
        fontFamily: 'Share Tech Mono', fontSize: '9px',
        color: '#ffff44', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(90).setVisible(false);

      // Effect banner (floats up after rolling)
      this.effectBanner = this.add.text(sw / 2, sh / 2 - 80, '', {
        fontFamily: 'Orbitron', fontSize: '18px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 5, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(96).setVisible(false);

      // Dice overlay
      this.diceOverlay = this.add.graphics().setScrollFactor(0).setDepth(97).setVisible(false);
      this.diceTxt = this.add.text(sw / 2, sh / 2, '', {
        fontFamily: 'Orbitron', fontSize: '52px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(98).setVisible(false);
    }
  }

  // ── Input ────────────────────────────────────────────────────────
  _setupInput() {
    const kb = this.input.keyboard;
    this.keys = {
      up:    kb.addKey('W'),
      down:  kb.addKey('S'),
      left:  kb.addKey('A'),
      right: kb.addKey('D'),
      q: kb.addKey('Q'),
    };

    this.input.on('pointermove', p => { this.ptrX = p.x; this.ptrY = p.y; });
    this.input.on('pointerdown', p => { if (p.leftButtonDown()) this.fireHeld = true; });
    this.input.on('pointerup',   () => { this.fireHeld = false; });
  }

  // ── Server messages ─────────────────────────────────────────────
  _onMsg(m) {
    switch (m.type) {
      case 'ffa_state':
        this.state = m;
        if (this.isRTD && m.players && m.players[this.myIdx]) {
          this.canRoll = !!m.players[this.myIdx].canRoll;
        }
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
        this.time.delayedCall(500, () => showFFAResult(m.leaderboard, false, m.code));
        break;

      case 'ffa_disbanded':
        showFFAResult(null, true);
        break;

      // ── RTD ─────────────────────────────────────────────────────
      case 'rtd_roll_earned':
        if (!this.isRTD) break;
        this._showToast(`🎲 ROLL READY!  (${m.kills} kills)`, '#ffff44', 3000);
        break;

      case 'rtd_no_points':
        if (!this.isRTD) break;
        this._showToast(`NOT ENOUGH POINTS  (${m.have}/${m.need})`, '#ff4060', 2000);
        break;

      case 'rtd_rolled': {
        if (!this.isRTD) break;
        const eff   = (typeof RTD_BY_ID !== 'undefined') ? RTD_BY_ID[m.effectId] : null;
        const label = eff ? eff.label : m.effectId;
        const color = eff ? eff.color : '#ffffff';
        const isMe  = m.playerIdx === this.myIdx;

        if (isMe) {
          this._playDiceAnimation(label, color);
        } else {
          const pCol = '#' + (PLAYER_COLS[m.playerIdx] || 0xffffff).toString(16).padStart(6, '0');
          this._showToast(`P${m.playerIdx + 1} rolled: ${label}`, pCol, 3500);
        }
        break;
      }
    }
  }

  // ── Input send ───────────────────────────────────────────────────
  _sendInput() {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;

    const ptr = this.input.activePointer;
    const cx  = this.scale.width  / 2;
    const cy  = this.scale.height / 2;
    const ta  = Phaser.Math.RadToDeg(Math.atan2(ptr.y - cy, ptr.x - cx)) + 90;

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

    // RTD: send roll request when flagged by update()
    if (this.isRTD && this._rollPending) {
      this._rollPending = false;
      this.sock.send(JSON.stringify({ type: 'ffa_roll' }));
      this.canRoll = false; // optimistic — confirmed by rtd_rolled from server
    }
  }

  // ── Update ───────────────────────────────────────────────────────
  update(_, delta) {
    if (!this.state) return;
    const st = this.state;

    // Re-check mode every frame in case ffaLobbyMode was set after scene created
    this.isRTD = (typeof ffaLobbyMode !== 'undefined') && ffaLobbyMode === 'rtd';

    // RTD: detect Q press here inside Phaser's update loop
    // (JustDown only works reliably here, not inside setInterval)
    // Re-read canRoll straight from latest state so it's always fresh
    if (this.isRTD && st.players && st.players[this.myIdx]) {
      this.canRoll = !!st.players[this.myIdx].canRoll;
    }

    if (this.isRTD && Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      if (this.canRoll && !this._diceAnimActive) {
        this._rollPending = true;
      } else {
        // Tell server anyway so it sends back rtd_no_points if applicable
        if (this.sock && this.sock.readyState === WebSocket.OPEN) {
          this.sock.send(JSON.stringify({ type: 'ffa_roll' }));
        }
      }
    }

    for (const [iStr, pd] of Object.entries(st.players)) {
      this._syncSprite(parseInt(iStr), pd);
    }

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

    // Tint tank to show active RTD effect
    if (this.isRTD && pd.effect) {
      const eff = (typeof RTD_BY_ID !== 'undefined') ? RTD_BY_ID[pd.effect] : null;
      const tintHex = eff ? parseInt(eff.color.replace('#', ''), 16) : 0xffffff;
      sp.body.setTint(tintHex);
      sp.turret.setTint(tintHex);
    } else if (!isMe) {
      const col = PLAYER_COLS[idx] || 0xffffff;
      sp.body.setTint(col);
      sp.turret.setTint(col);
    } else {
      sp.body.clearTint();
      sp.turret.clearTint();
    }

    const BW  = 36;
    const pct = Math.max(0, pd.hp / 100);
    sp.hpBg.setPosition(sp.body.x, sp.body.y - 28);
    sp.hpBar.setPosition(sp.body.x - BW / 2, sp.body.y - 28);
    sp.hpBar.displayWidth = BW * pct;
    sp.tag.setPosition(sp.body.x, sp.body.y - 40);
    sp.tag.setText(`P${idx + 1}  ${pd.kills ?? 0}K${this.isRTD && pd.effect ? ' ✦' : ''}`);
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
        if (b.wallhack) {
          // Ghost bullet — translucent with outer ring
          g.fillStyle(c, 0.45); g.fillCircle(0, 0, 5);
          g.lineStyle(1.5, c, 0.9); g.strokeCircle(0, 0, 8);
        } else if (b.bouncy) {
          // Bouncy bullet — solid with white ring
          g.fillStyle(c, 1); g.fillCircle(0, 0, 5);
          g.fillStyle(0xffffff, 0.6); g.fillCircle(-2, -2, 2);
          g.lineStyle(1.5, 0xffffff, 0.6); g.strokeCircle(0, 0, 8);
        } else {
          g.fillStyle(c, 1); g.fillCircle(0, 0, 5);
          g.fillStyle(0xffffff, 0.4); g.fillCircle(-2, -2, 2);
        }
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
    if (me) {
      hudHp    = me.hp;
      hudScore = me.kills || 0;
      if (typeof hudPoints !== 'undefined') hudPoints = me.points || 0;
      refreshHUD();
      // Show/hide POINTS block only in RTD mode
      const _ptBlock = document.getElementById('hud-points-block');
      if (_ptBlock) _ptBlock.style.display = this.isRTD ? '' : 'none';
    }

    // ── RTD HUD ───────────────────────────────────────────────────
    if (!this.isRTD) return;

    // Roll prompt — visible and pulsing when a roll is available
    if (this.rollPrompt) {
      const show = this.canRoll && !this._diceAnimActive;
      this.rollPrompt.setVisible(show);
      if (show && !this.rollPulseTween) {
        this.rollPulseTween = this.tweens.add({
          targets: this.rollPrompt, alpha: { from: 1, to: 0.25 },
          duration: 500, yoyo: true, repeat: -1,
        });
      } else if (!show && this.rollPulseTween) {
        this.rollPulseTween.stop();
        this.rollPulseTween = null;
        this.rollPrompt.setAlpha(1);
      }
    }

    // Active effect indicator under Phaser timer
    if (this.effectIndicator && me) {
      if (me.effect) {
        const eff = (typeof RTD_BY_ID !== 'undefined') ? RTD_BY_ID[me.effect] : null;
        this.effectIndicator.setText(`✦ ${eff ? eff.label : me.effect} ✦`);
        this.effectIndicator.setColor(eff ? eff.color : '#ffff44');
        this.effectIndicator.setVisible(true);
      } else {
        this.effectIndicator.setVisible(false);
      }
    }

    // Drive center DOM HUD every frame from server state (avoids stale message-based updates)
    const wtEl = document.getElementById('wave-title');
    const wnEl = document.getElementById('wave-num');
    if (wtEl && wnEl) {
      if (this.isRTD) {
        if (me && me.effect) {
          const eff = (typeof RTD_BY_ID !== 'undefined') ? RTD_BY_ID[me.effect] : null;
          wtEl.textContent = '🎲 ACTIVE';
          wtEl.style.color = '#ffffff';
          wtEl.style.fontSize = '9px';
          wnEl.textContent = eff ? eff.label : me.effect;
          wnEl.style.color = eff ? eff.color : '#ffff44';
          wnEl.style.fontSize = '10px';
          wnEl.style.letterSpacing = '1px';
        } else {
          wtEl.textContent = 'RTD';
          wtEl.style.color = '#aa44ff';
          wtEl.style.fontSize = '';
          wnEl.textContent = '';
          wnEl.style.color = '';
          wnEl.style.fontSize = '';
        }
      } else {
        wtEl.textContent = '';
        wnEl.textContent = '';
      }
    }
  }

  // ── RTD: Dice roll animation ─────────────────────────────────────
  _playDiceAnimation(effectLabel, effectColor) {
    if (!this.diceTxt) return;
    this._diceAnimActive = true;

    const sw = this.scale.width, sh = this.scale.height;
    const SYMS = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const TOTAL = 20;
    let tick = 0;

    // Dim overlay
    this.diceOverlay
      .clear()
      .fillStyle(0x000000, 0.6)
      .fillRect(0, 0, sw, sh)
      .setVisible(true);

    this.diceTxt.setText(SYMS[0]).setColor('#ffffff').setScale(1).setAlpha(1).setVisible(true);

    this.time.addEvent({
      delay: 55,
      repeat: TOTAL - 1,
      callback: () => {
        tick++;
        const sym = SYMS[Math.floor(Math.random() * SYMS.length)];
        // Slow down near the end
        const wobble = 0.85 + Math.random() * 0.3;
        this.diceTxt.setText(sym).setScale(wobble);

        if (tick > TOTAL - 5) this.diceTxt.setColor(effectColor);

        if (tick === TOTAL) {
          // Lock on ⚅ and show result
          this.diceTxt.setText('⚅').setColor(effectColor).setScale(1.5);

          // Float-up effect label
          if (this.effectBanner) {
            this.effectBanner
              .setText(effectLabel).setColor(effectColor)
              .setY(sh / 2 - 80).setAlpha(1).setVisible(true);
            this.tweens.add({
              targets: this.effectBanner,
              alpha: 0, y: sh / 2 - 140,
              duration: 2200, ease: 'Cubic.Out',
              onComplete: () => {
                this.effectBanner.setVisible(false).setY(sh / 2 - 80);
              },
            });
          }

          // Shrink dice away after a beat
          this.tweens.add({
            targets: this.diceTxt,
            scaleX: 0, scaleY: 0, alpha: 0,
            delay: 900, duration: 350, ease: 'Back.In',
            onComplete: () => {
              this.diceTxt.setVisible(false).setScale(1).setAlpha(1);
              this.diceOverlay.clear().setVisible(false);
              this._diceAnimActive = false;
            },
          });
        }
      },
    });
  }

  // ── RTD: Toast ───────────────────────────────────────────────────
  _showToast(msg, color, duration) {
    const sw = this.scale.width, sh = this.scale.height;
    const t = this.add.text(sw / 2, sh - 55, msg, {
      fontFamily: 'Share Tech Mono', fontSize: '11px',
      color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(94).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: 1, y: sh - 65,
      duration: 200, ease: 'Cubic.Out',
      onComplete: () => {
        this.time.delayedCall(duration - 450, () => {
          this.tweens.add({
            targets: t, alpha: 0,
            duration: 400,
            onComplete: () => t.destroy(),
          });
        });
      },
    });
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
    // Gold crosshair when a roll is available
    const col = (this.isRTD && this.canRoll) ? 0xffff44 : 0x00e5ff;
    g.lineStyle(1.5, col, 0.85);
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