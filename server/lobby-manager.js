// ================================================================
//  lobby-manager.js
//
//  Manages all active lobbies in memory.
//  A lobby holds two WebSocket connections and their game state.
//
//  Lobby lifecycle:
//    create()  → lobby exists, waiting for second player
//    join()    → both players connected, lobby is "ready"
//    destroy() → game over or a player disconnected
// ================================================================

const lobbies = new Map(); // code → lobby object

// Characters used for lobby codes — no 0/O/I/1 to avoid confusion
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate a random 4-character lobby code. */
function generateCode() {
  let code;
  // Keep generating until we get one that isn't already in use
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (lobbies.has(code));
  return code;
}

/**
 * Create a new lobby.
 * @returns {{ code: string, lobby: object }}
 */
function createLobby() {
  const code = generateCode();
  const lobby = {
    code,
    status: 'waiting',   // 'waiting' | 'ready' | 'playing' | 'over'
    players: [null, null], // index 0 = host, index 1 = guest
    sockets: [null, null],
    gameState: null,       // set when game starts
    tickInterval: null,    // the server game loop interval
    createdAt: Date.now(),
  };
  lobbies.set(code, lobby);
  console.log(`[lobby] Created: ${code}`);
  return { code, lobby };
}

/**
 * Attach a WebSocket to a lobby slot.
 * @param {string} code
 * @param {WebSocket} socket
 * @param {number} playerIndex - 0 or 1
 */
function attachSocket(code, socket, playerIndex) {
  const lobby = lobbies.get(code);
  if (!lobby) return false;
  lobby.sockets[playerIndex] = socket;
  return true;
}

/**
 * Join an existing lobby as the guest (player 1).
 * @param {string} code
 * @returns {{ ok: boolean, error?: string, lobby?: object }}
 */
function joinLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby)              return { ok: false, error: 'Lobby not found' };
  if (lobby.status !== 'waiting') return { ok: false, error: 'Lobby is full or already started' };

  lobby.status = 'ready';
  console.log(`[lobby] Joined: ${code}`);
  return { ok: true, lobby };
}

/**
 * Get a lobby by code.
 * @param {string} code
 */
function getLobby(code) {
  return lobbies.get(code) || null;
}

/**
 * Destroy a lobby and clear its game loop.
 * @param {string} code
 */
function destroyLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  if (lobby.tickInterval) clearInterval(lobby.tickInterval);
  lobbies.delete(code);
  console.log(`[lobby] Destroyed: ${code}`);
}

/**
 * Broadcast a message to both players in a lobby.
 * @param {object} lobby
 * @param {object} msg - will be JSON.stringified
 */
function broadcast(lobby, msg) {
  const data = JSON.stringify(msg);
  for (const socket of lobby.sockets) {
    if (socket && socket.readyState === 1 /* OPEN */) {
      socket.send(data);
    }
  }
}

/**
 * Send a message to one player only.
 * @param {WebSocket} socket
 * @param {object} msg
 */
function send(socket, msg) {
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(msg));
  }
}

// Automatically clean up lobbies that are stuck in 'waiting' for > 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [code, lobby] of lobbies) {
    if (lobby.createdAt < cutoff && lobby.status === 'waiting') {
      console.log(`[lobby] Expiring stale lobby: ${code}`);
      destroyLobby(code);
    }
  }
}, 60_000);

module.exports = { createLobby, joinLobby, getLobby, attachSocket, destroyLobby, broadcast, send };
