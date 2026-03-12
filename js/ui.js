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
        showScreen('screen-main');
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
  duelSocket.send(JSON.stringify({ type: 'start_game' }));
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

  if (duelSocket) { duelSocket.close(); duelSocket = null; }
  showScreen('screen-duel-result');
}

// ── Viewport scaling ──────────────────────────────────────────────
(function initScaling() {
  const DESIGN_W = 900, DESIGN_H = 668;
  function applyScale() {
    const scale   = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    const wrapper = document.getElementById('game-wrapper');
    wrapper.style.transform  = `scale(${scale})`;
    wrapper.style.marginLeft = (window.innerWidth  - DESIGN_W * scale) / 2 + 'px';
    wrapper.style.marginTop  = (window.innerHeight - DESIGN_H * scale) / 2 + 'px';
  }
  applyScale();
  window.addEventListener('resize', applyScale);
})();
