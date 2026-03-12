// ================================================================
//  game-state.js
//
//  Creates and manages the authoritative game state for a 1v1 match.
//  The server owns this state — clients only send inputs,
//  never positions or HP values.
// ================================================================

const MAP_W = 900;
const MAP_H = 600;
const MAX_HP = 100;
const PLAYER_SPEED = 170;   // px per second
const BULLET_SPEED = 530;   // px per second
const FIRE_COOLDOWN = 270;  // ms
const BULLET_DMG = 34;
const BULLET_RADIUS = 5;
const TANK_RADIUS = 16;     // collision radius for tanks

// Starting positions for each player (mirrored)
const SPAWN = [
  { x: 180, y: 300 },  // player 0 — left side
  { x: 720, y: 300 },  // player 1 — right side
];

/**
 * Create a fresh game state for a new match.
 * @returns {object} state
 */
function createGameState() {
  return {
    tick: 0,
    status: 'playing',   // 'playing' | 'over'
    winner: null,        // null | 0 | 1

    players: [
      {
        x: SPAWN[0].x, y: SPAWN[0].y,
        angle: 90,        // body rotation (degrees, 0 = up)
        turretAngle: 90,
        hp: MAX_HP,
        alive: true,
        lastFire: 0,
        // Latest input received from this player's client
        input: { up: false, down: false, left: false, right: false, fire: false, turretAngle: 90 },
      },
      {
        x: SPAWN[1].x, y: SPAWN[1].y,
        angle: -90,
        turretAngle: -90,
        hp: MAX_HP,
        alive: true,
        lastFire: 0,
        input: { up: false, down: false, left: false, right: false, fire: false, turretAngle: -90 },
      },
    ],

    bullets: [],      // { id, ownerIndex, x, y, vx, vy, born }
    nextBulletId: 0,
  };
}

/**
 * Apply a client input packet to a player's input state.
 * @param {object} state
 * @param {number} playerIndex
 * @param {object} input  { up, down, left, right, fire, turretAngle }
 */
function applyInput(state, playerIndex, input) {
  const p = state.players[playerIndex];
  if (!p || !p.alive) return;
  Object.assign(p.input, input);
}

module.exports = { createGameState, applyInput, MAP_W, MAP_H, MAX_HP, PLAYER_SPEED, BULLET_SPEED, FIRE_COOLDOWN, BULLET_DMG, BULLET_RADIUS, TANK_RADIUS, SPAWN };
