// ================================================================
//  state.js
//  Single source of truth for all mutable runtime state.
// ================================================================

// Active Phaser game instance (null when on a menu screen)
let phaserGame = null;

// Currently selected difficulty key (matches a key in DIFFS)
let activeDiff = 'normal';

// HUD values — written by the Phaser scene, read by hud.js
let hudHp    = MAX_HP;
let hudWave  = 1;
let hudScore  = 0;
let hudKills  = 0;
let hudPoints = 0; // FFA RTD points (kills × 10)

// ── Duel / 1v1 state ─────────────────────────────────────────────
// The active WebSocket to the game server
let duelSocket      = null;
// 0 = host, 1 = guest
let duelPlayerIndex = 0;
// The 4-letter lobby code
let duelLobbyCode   = null;

// Server base URL — auto-detected from current page host.
// In dev:  http://localhost:3000  (run server/server.js)
// In prod: set to your deployed server domain
const SERVER_HTTP = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : `${window.location.protocol}//${window.location.host}`;

const SERVER_WS = SERVER_HTTP.replace('http', 'ws');
