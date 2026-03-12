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
];

// ── Screen switching ──────────────────────────────────────────────
function showScreen(id) {
  SCREENS.forEach(s => {
    document.getElementById(s).classList.toggle('active', s === id);
  });
  document.getElementById('overlay').classList.remove('hidden');
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

function applyScale() {
  const wrapper = document.getElementById('game-wrapper');

  // Use Phaser canvas dimensions when in-game, menu defaults otherwise
  const canvas = wrapper.querySelector('canvas');
  const cW = (canvas && canvas.width  > 0) ? canvas.width  : MENU_CANVAS_W;
  const cH = (canvas && canvas.height > 0) ? canvas.height : MENU_CANVAS_H;

  const totalW = cW;
  const totalH = cH + HUD_H + HINT_H;

  const scale = Math.min(
    window.innerWidth  / totalW,
    window.innerHeight / totalH
  );

  const scaledW = totalW * scale;
  const scaledH = totalH * scale;
  const left    = (window.innerWidth  - scaledW) / 2;
  const top     = (window.innerHeight - scaledH) / 2;

  wrapper.style.width     = totalW + 'px';
  wrapper.style.height    = totalH + 'px';
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.left      = left + 'px';
  wrapper.style.top       = top  + 'px';
}

(function initScaling() {
  applyScale();
  window.addEventListener('resize', applyScale);
})();
