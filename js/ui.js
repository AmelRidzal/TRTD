// ================================================================
//  ui.js
//  Menu navigation, game launch, result screens, viewport scaling.
// ================================================================

const SCREENS = [
  'screen-main',
  'screen-diff',
  'screen-result',
  'screen-duel-menu',
  'screen-duel-create',
  'screen-duel-join',
  'screen-duel-lobby',
  'screen-duel-result',
  'screen-ffa-menu',
  'screen-ffa-join',
  'screen-ffa-lobby',
  'screen-ffa-result',
];

// ── Screen switching ──────────────────────────────────────────────
function showScreen(id) {
  SCREENS.forEach(s => {
    document.getElementById(s).classList.toggle('active', s === id);
  });
  document.getElementById('overlay').classList.remove('hidden');

  // Restore wave HUD elements when leaving FFA game
  if (id !== 'screen-ffa-result') {
    document.getElementById('wave-title').style.visibility = '';
    document.getElementById('wave-num').style.visibility   = '';
  }

  // When returning to any menu screen, destroy the game and reset scale to menu size
  // so the overlay/buttons render at full size instead of FFA's shrunken scale
  const isMenuScreen = !['screen-ffa-result', 'screen-duel-result', 'screen-result'].includes(id);
  if (isMenuScreen && phaserGame) {
    try { phaserGame.destroy(true); } catch {}
    phaserGame = null;
  }
  if (isMenuScreen) {
    applyScale(MENU_CANVAS_W, MENU_CANVAS_H);
  }
}

// ── Wave Clear ────────────────────────────────────────────────────
function launchGame(diff) {
  activeDiff = diff;
  hudHp = MAX_HP; hudWave = 1; hudScore = 0; hudKills = 0;
  refreshHUD();

  document.getElementById('retry-btn').onclick = () => launchGame(activeDiff);
  document.getElementById('overlay').classList.add('hidden');

  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  phaserGame = startPhaserGame('WaveScene');
}

function showResult(won) {
  document.getElementById('res-wave').textContent  = hudWave;
  document.getElementById('res-kills').textContent = hudKills;
  document.getElementById('res-score').textContent = hudScore;

  const titleEl = document.getElementById('result-title');
  const subEl   = document.getElementById('result-sub');
  if (won) {
    titleEl.textContent = 'CLEARED!'; titleEl.style.color = '#00e5ff';
    subEl.textContent   = 'ALL WAVES DEFEATED';
  } else {
    titleEl.textContent = 'GAME OVER'; titleEl.style.color = '#ff4060';
    subEl.textContent   = `DESTROYED ON WAVE ${hudWave}`;
  }
  showScreen('screen-result');
}

// ── Duel lobby — Create ───────────────────────────────────────────
async function createDuelLobby() {
  // Show the create screen immediately with a loading state
  document.getElementById('lobby-code-display').textContent = '····';
  document.getElementById('create-status').textContent = 'Creating lobby...';
  showScreen('screen-duel-create');

  try {
    const res  = await fetch(`${SERVER_HTTP}/api/lobby/create`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    duelLobbyCode   = data.code;
    duelPlayerIndex = 0;

    document.getElementById('lobby-code-display').textContent = data.code;
    document.getElementById('create-status').textContent = 'Waiting for opponent...';

    _connectDuelSocket(data.code, 0);

  } catch (err) {
    alert('Could not reach server. Is it running?\n\n' + err.message);
    showScreen('screen-duel-menu');
  }
}

// ── Duel lobby — Join ─────────────────────────────────────────────
async function joinDuelLobby() {
  const input = document.getElementById('join-code-input');
  const code  = input.value.toUpperCase().trim();
  if (code.length !== 4) { alert('Enter a 4-letter lobby code.'); return; }

  const btn = document.getElementById('join-lobby-btn');
  btn.textContent = 'JOINING...';
  btn.disabled    = true;

  try {
    const res  = await fetch(`${SERVER_HTTP}/api/lobby/join`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    duelLobbyCode   = code;
    duelPlayerIndex = 1;

    document.getElementById('lobby-code-big').textContent  = code;
    document.getElementById('lobby-status').textContent    = 'Connecting...';
    document.getElementById('start-game-btn').style.display = 'none';
    showScreen('screen-duel-lobby');

    _connectDuelSocket(code, 1);

  } catch (err) {
    alert('Could not join: ' + err.message);
  } finally {
    btn.textContent = 'JOIN';
    btn.disabled    = false;
  }
}

// ── WebSocket connection ──────────────────────────────────────────
function _connectDuelSocket(code, playerIndex) {
  if (duelSocket) { duelSocket.close(); duelSocket = null; }

  const url = `${SERVER_WS}/game?code=${code}&player=${playerIndex}`;
  duelSocket = new WebSocket(url);

  duelSocket.onopen = () => {
    console.log('[duel] WebSocket connected');
  };

  duelSocket.onmessage = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }

    switch (msg.type) {

      case 'connected':
        if (playerIndex === 0) {
          document.getElementById('create-status').textContent = 'Waiting for opponent...';
        } else {
          document.getElementById('lobby-status').textContent = 'Waiting for host to start...';
        }
        break;

      case 'lobby_ready':
        // Move host from create screen → lobby screen
        document.getElementById('lobby-code-big').textContent = duelLobbyCode;
        if (playerIndex === 0) {
          document.getElementById('lobby-status').textContent    = 'Opponent connected! Ready to start.';
          document.getElementById('start-game-btn').style.display = 'block';
        } else {
          document.getElementById('lobby-status').textContent = 'Waiting for host to start...';
        }
        showScreen('screen-duel-lobby');
        break;

      case 'game_start':
        _launchDuelGame();
        break;

      case 'opponent_disconnected':
        alert('Your opponent disconnected.');
        if (duelSocket) { duelSocket.close(); duelSocket = null; }
        showScreen('screen-main');
        break;

      case 'map_selected':
        // Server picked the map — sync activeMap so the scene builds the right one
        if (MAPS[msg.mapId]) activeMap = MAPS[msg.mapId];
        break;

      case 'rematch_request':
      case 'rematch_start':
        _handleRematchMessage(msg.type);
        break;
    }
  };

  duelSocket.onerror = () => {
    alert('WebSocket error. Is the server running at ' + SERVER_HTTP + '?');
    showScreen('screen-main');
  };

  duelSocket.onclose = () => {
    console.log('[duel] WebSocket closed');
  };
}

// Host clicks START
function startDuelGame() {
  if (!duelSocket || duelSocket.readyState !== WebSocket.OPEN) return;
  duelSocket.send(JSON.stringify({ type: 'start_game', mapId: activeMap.id }));
}

// Both clients receive game_start → launch DuelScene
function _launchDuelGame() {
  hudHp = 100; refreshHUD();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('wave-title').textContent = 'VS';
  document.getElementById('wave-num').textContent   = '1V1';

  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  phaserGame = startPhaserGame('DuelScene');
}

// ── Duel result ───────────────────────────────────────────────────
function showDuelResult(won, forfeit = false) {
  const titleEl = document.getElementById('duel-result-title');
  const subEl   = document.getElementById('duel-result-sub');

  if (forfeit) {
    titleEl.textContent = 'YOU WIN';  titleEl.style.color = '#00e5ff';
    subEl.textContent   = 'OPPONENT DISCONNECTED';
  } else if (won) {
    titleEl.textContent = 'YOU WIN';  titleEl.style.color = '#00e5ff';
    subEl.textContent   = 'ENEMY TANK DESTROYED';
  } else {
    titleEl.textContent = 'DEFEATED'; titleEl.style.color = '#ff4060';
    subEl.textContent   = 'YOUR TANK WAS DESTROYED';
  }

  // Reset rematch UI
  const notif = document.getElementById('rematch-notification');
  const btn   = document.getElementById('rematch-btn');
  if (notif) { notif.style.display = 'none'; }
  if (btn)   { btn.textContent = '⟳ REMATCH'; btn.disabled = false; btn.classList.remove('waiting-rematch'); }

  // Keep socket alive for rematch — don't close it here
  showScreen('screen-duel-result');
}


// ── Copy lobby code ───────────────────────────────────────────────
function copyLobbyCode() {
  const code = duelLobbyCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btn   = document.getElementById('copy-code-btn');
    const label = document.getElementById('copy-code-label');
    label.textContent = '✓ COPIED!';
    btn.classList.add('copied');
    setTimeout(() => {
      label.textContent = '⎘ COPY CODE';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback for browsers that block clipboard without HTTPS
    prompt('Copy this code:', code);
  });
}

// ── Rematch ───────────────────────────────────────────────────────
// State: 0 = neither, 1 = I requested, 2 = both → restart
let _rematchMine = false;

function requestRematch() {
  if (!duelSocket || duelSocket.readyState !== WebSocket.OPEN) {
    alert('Connection lost. Start a new lobby.');
    showScreen('screen-main');
    return;
  }
  _rematchMine = true;
  duelSocket.send(JSON.stringify({ type: 'rematch_request' }));

  const btn = document.getElementById('rematch-btn');
  btn.textContent = '⟳ WAITING...';
  btn.classList.add('waiting-rematch');
  btn.disabled = true;
}

// Called from _connectDuelSocket's onmessage handler
function _handleRematchMessage(type) {
  if (type === 'rematch_request') {
    // Opponent wants a rematch — show notification
    const notif = document.getElementById('rematch-notification');
    const text  = document.getElementById('rematch-notification-text');
    text.textContent = 'Opponent wants a rematch!';
    notif.style.display = 'flex';
  }
  if (type === 'rematch_start') {
    // Both agreed — restart the game
    _rematchMine = false;
    if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
    _launchDuelGame();
  }
}

// ── Viewport scaling ──────────────────────────────────────────────
// #game-wrapper is position:absolute inside #scale-root (position:fixed).
// applyScale() sets its width, height, scale, left, and top so it
// always fills the viewport correctly regardless of map size.

const HUD_H  = 46;   // px — fixed HUD strip height
const HINT_H = 28;   // px — fixed hint strip height
const MENU_CANVAS_W = 900;
const MENU_CANVAS_H = 600;

function applyScale(overrideW, overrideH) {
  const wrapper = document.getElementById('game-wrapper');
  const hud     = document.getElementById('hud');
  const hint    = document.getElementById('controls-hint');

  // Use override dims, then live canvas dims, then menu defaults
  const canvas = wrapper.querySelector('canvas');
  const cW = overrideW || (canvas && canvas.width  > 0 ? canvas.width  : MENU_CANVAS_W);
  const cH = overrideH || (canvas && canvas.height > 0 ? canvas.height : MENU_CANVAS_H);

  // Scale the canvas to fit the viewport, reserving space for HUD + hint
  const scale = Math.min(
    window.innerWidth  / cW,
    window.innerHeight / (cH + HUD_H + HINT_H)
  );

  const scaledW = cW    * scale;
  const scaledH = cH    * scale;
  const totalH  = scaledH + HUD_H + HINT_H;
  const left    = (window.innerWidth  - scaledW) / 2;
  const top     = (window.innerHeight - totalH)  / 2;

  window._cssScale = scale;

  // Canvas wrapper — only the game canvas is scaled
  wrapper.style.width     = cW + 'px';
  wrapper.style.height    = cH + 'px';
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = 'top left';
  wrapper.style.left      = left + 'px';
  wrapper.style.top       = (top + HUD_H) + 'px';

  // HUD sits above canvas at its natural size — never scaled
  hud.style.width  = scaledW + 'px';
  hud.style.left   = left + 'px';
  hud.style.top    = top + 'px';

  // Controls hint sits below canvas at natural size — never scaled
  hint.style.width = scaledW + 'px';
  hint.style.left  = left + 'px';
  hint.style.top   = (top + HUD_H + scaledH) + 'px';
}

(function initScaling() {
  applyScale();
  window.addEventListener('resize', applyScale);
})();


// ================================================================
//  FFA — Free-For-All UI
// ================================================================
let ffaLobbyCode = null;

async function createFFALobby() {
  try {
    const r = await fetch(`${SERVER_HTTP}/api/ffa/create`, {method:'POST'});
    const d = await r.json();
    if (!d.ok) throw new Error(d.error);
    ffaLobbyCode = d.code;
    document.getElementById('ffa-lobby-code-big').textContent = d.code;
    document.getElementById('ffa-lobby-status').textContent =
      d.inProgress ? 'Joining game in progress...' : 'Connecting...';
    showScreen('screen-ffa-lobby');
    _connectFFASocket(d.code);
  } catch(e) {
    alert('Could not create FFA lobby: ' + e.message);
  }
}

async function joinFFALobbyUI() {
  const code = document.getElementById('ffa-join-code-input').value.trim().toUpperCase();
  if (code.length !== 4) { alert('Enter a 4-letter code'); return; }
  try {
    const r = await fetch(`${SERVER_HTTP}/api/ffa/join`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({code}),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error);
    ffaLobbyCode = d.code;
    document.getElementById('ffa-lobby-code-big').textContent = d.code;
    document.getElementById('ffa-lobby-status').textContent =
      d.inProgress ? 'Joining game in progress...' : 'Connecting...';
    showScreen('screen-ffa-lobby');
    _connectFFASocket(d.code);
  } catch(e) {
    alert('Could not join: ' + e.message);
  }
}

function _connectFFASocket(code) {
  // Reuse duelSocket global so ffa-scene.js can access it
  if (duelSocket) { try{duelSocket.close();}catch{} }
  duelSocket = new WebSocket(`${SERVER_WS}/game?code=${code}&mode=ffa`);

  duelSocket.onmessage = evt => {
    let m; try{m=JSON.parse(evt.data);}catch{return;}

    if (m.type === 'ffa_joined') {
      duelPlayerIndex = m.playerIndex;
      if (m.inProgress) {
        // Game already running — skip lobby, launch straight into the game
        // ffa_start will follow immediately from server to kick off the scene
        document.getElementById('ffa-lobby-status').textContent = 'Joining game in progress...';
      } else {
        const isHost = m.playerIndex === 0;
        document.getElementById('ffa-start-btn').style.display = isHost ? 'block' : 'none';
        _ffaUpdateSlots(m.playerIndex + 1);
      }
    }
    if (m.type === 'ffa_lobby_update') {
      _ffaUpdateSlots(m.count);
      const canStart = m.count >= 2;
      const btn = document.getElementById('ffa-start-btn');
      if (btn) btn.textContent = `▶ START (${m.count} players)`;
      document.getElementById('ffa-lobby-status').textContent =
        canStart ? `${m.count} players ready — host can start!`
                 : `Waiting for players… (${m.count}/8, need 2+)`;
    }
    if (m.type === 'ffa_start') {
      _launchFFAGame();
    }
    if (m.type === 'ffa_disbanded') {
      alert('The host disbanded the lobby.');
      showScreen('screen-main');
    }
  };
  duelSocket.onerror = () => alert('WebSocket error — is the server running?');
}

function _ffaUpdateSlots(count) {
  const list = document.getElementById('ffa-player-list');
  if (!list) return;
  list.innerHTML = '';
  const cols = ['#00e5ff','#ff4060','#44ff88','#ffaa00','#aa44ff','#ff44cc','#ffff44','#44aaff'];
  for (let i=0;i<count;i++) {
    const row = document.createElement('div');
    row.className = 'ffa-player-row';
    row.innerHTML = `<span class="ffa-slot-dot" style="background:${cols[i]||'#555'}"></span>Player ${i+1}${i===duelPlayerIndex?' (you)':''}`;
    list.appendChild(row);
  }
  if (count < 8) {
    const row = document.createElement('div');
    row.className = 'ffa-player-row waiting';
    row.innerHTML = '<span class="ffa-slot-dot"></span>Waiting for players…';
    list.appendChild(row);
  }
}

function startFFAGame() {
  if (!duelSocket || duelSocket.readyState !== WebSocket.OPEN) return;
  duelSocket.send(JSON.stringify({type:'ffa_start_game'}));
}

function _launchFFAGame() {
  document.getElementById('overlay').classList.add('hidden');

  // Fix 5: hide wave-mode HUD elements — irrelevant in FFA
  document.getElementById('wave-title').style.visibility = 'hidden';
  document.getElementById('wave-num').style.visibility   = 'hidden';

  if (phaserGame) { try { phaserGame.destroy(true); } catch {} phaserGame = null; }
  activeMap = MAP_FFA;

  // Buffer any state messages that arrive before the scene's create() runs.
  window._ffaMsgQueue = [];
  duelSocket.onmessage = evt => {
    let m; try { m = JSON.parse(evt.data); } catch { return; }
    window._ffaMsgQueue.push(m);
  };

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: MAP_FFA.width,
    height: MAP_FFA.height,
    parent: 'phaser-container',
    backgroundColor: '#06060f',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [FFAScene],
    audio: { noAudio: true },
  });

  // Fix 4: force applyScale with the known FFA canvas size immediately,
  // then again once Phaser has actually inserted the canvas element.
  applyScale(MAP_FFA.width, MAP_FFA.height);
  const _waitForCanvas = setInterval(() => {
    const c = document.querySelector('#phaser-container canvas');
    if (c && c.width > 0) {
      clearInterval(_waitForCanvas);
      applyScale();
    }
  }, 30);
}

function copyFFACode() {
  if (!ffaLobbyCode) return;
  const lbl = document.getElementById('ffa-copy-label');
  navigator.clipboard.writeText(ffaLobbyCode).then(()=>{
    lbl.textContent='✓ COPIED!';
    setTimeout(()=>lbl.textContent='⎘ COPY CODE',2000);
  }).catch(()=>{
    prompt('Copy lobby code:', ffaLobbyCode);
  });
}

function showFFAResult(leaderboard, disbanded, code) {
  // Store the code so playAgainFFA() can reconnect to the same lobby
  if (code) ffaLobbyCode = code;

  document.getElementById('overlay').classList.remove('hidden');

  // Show/hide play again button — only available if lobby is still alive (not disbanded)
  const playAgainBtn = document.getElementById('ffa-play-again-btn');
  if (playAgainBtn) playAgainBtn.style.display = disbanded ? 'none' : '';

  if (disbanded) {
    document.getElementById('ffa-result-title').textContent = 'DISCONNECTED';
    document.getElementById('ffa-result-sub').textContent   = 'A player disconnected';
    document.getElementById('ffa-leaderboard').innerHTML    = '';
  } else {
    document.getElementById('ffa-result-title').textContent = 'TIME UP';
    document.getElementById('ffa-result-sub').textContent   = 'FINAL STANDINGS';
    const cols=['#00e5ff','#ff4060','#44ff88','#ffaa00','#aa44ff','#ff44cc','#ffff44','#44aaff'];
    document.getElementById('ffa-leaderboard').innerHTML = (leaderboard||[]).map((e,rank)=>`
      <div class="ffa-lb-row" style="color:${cols[e.idx]||'#fff'}">
        <span class="ffa-lb-rank">${rank===0?'🏆':rank+1+'.'}</span>
        <span class="ffa-lb-name">Player ${e.idx+1}${e.idx===duelPlayerIndex?' (you)':''}</span>
        <span class="ffa-lb-kills">${e.kills}K</span>
        <span class="ffa-lb-deaths">${e.deaths}D</span>
      </div>`).join('');
  }
  showScreen('screen-ffa-result');
}

// Reconnect to the same lobby and go back to the waiting room
async function playAgainFFA() {
  if (!ffaLobbyCode) { showScreen('screen-ffa-menu'); return; }
  const code = ffaLobbyCode;

  // Reconnect socket to the existing (now reset) lobby
  _connectFFASocket(code);

  // Show lobby screen so players can see who's back and host can restart
  document.getElementById('ffa-lobby-code-big').textContent = code;
  document.getElementById('ffa-lobby-status').textContent   = 'Reconnecting...';
  showScreen('screen-ffa-lobby');
}
