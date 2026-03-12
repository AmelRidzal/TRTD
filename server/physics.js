// ================================================================
//  physics.js
//
//  Runs one physics tick on the game state.
//  Called by the server at 30 Hz (every ~33 ms).
//
//  This file is the ONLY place hit detection and movement happen.
//  Clients never compute authoritative positions — they only render
//  what the server tells them.
// ================================================================

const {
  MAP_W, MAP_H, PLAYER_SPEED, BULLET_SPEED,
  FIRE_COOLDOWN, BULLET_DMG, BULLET_RADIUS, TANK_RADIUS,
} = require('./game-state');

// ── Wall layout (must match map-arena.js on the client) ─────────
// Each wall is { x, y, w, h } in world-space pixels.
// We generate them from the same tile coordinates the client uses.
const TILE = 40;

function makeBorderWalls() {
  const walls = [];
  for (let tx = 0; tx < MAP_W; tx += TILE) {
    walls.push({ x: tx, y: 0,          w: TILE, h: TILE });  // top row
    walls.push({ x: tx, y: MAP_H-TILE, w: TILE, h: TILE });  // bottom row
  }
  for (let ty = TILE; ty < MAP_H - TILE; ty += TILE) {
    walls.push({ x: 0,          y: ty, w: TILE, h: TILE });  // left col
    walls.push({ x: MAP_W-TILE, y: ty, w: TILE, h: TILE });  // right col
  }
  return walls;
}

const INTERIOR_TILES = [
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

// Convert tile centres to AABB rects (tile centre - half tile = top-left corner)
const WALLS = [
  ...makeBorderWalls(),
  ...INTERIOR_TILES.map(([cx, cy]) => ({
    x: cx - TILE / 2, y: cy - TILE / 2, w: TILE, h: TILE,
  })),
];

// ── AABB helpers ─────────────────────────────────────────────────

/** Circle vs AABB collision — returns true if they overlap. */
function circleAABB(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

/** Check if a circle is touching any wall. */
function collidesWithWall(cx, cy, cr) {
  for (const w of WALLS) {
    if (circleAABB(cx, cy, cr, w.x, w.y, w.w, w.h)) return true;
  }
  return false;
}

// ── Main tick ────────────────────────────────────────────────────

/**
 * Advance the game by one tick.
 * @param {object} state   - the authoritative game state
 * @param {number} dt      - elapsed seconds since last tick (should be ~0.033)
 * @param {number} nowMs   - current timestamp in ms (for fire cooldown)
 * @returns {object|null}  - { winner: 0|1 } if game ended this tick, else null
 */
function tick(state, dt, nowMs) {
  if (state.status !== 'playing') return null;

  // ── Move players ──────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p.alive) continue;

    const inp = p.input;
    let dx = 0, dy = 0;
    if (inp.up)    dy -= 1;
    if (inp.down)  dy += 1;
    if (inp.left)  dx -= 1;
    if (inp.right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;

      const nx = p.x + dx * PLAYER_SPEED * dt;
      const ny = p.y + dy * PLAYER_SPEED * dt;

      // Apply movement axes independently so you can slide along walls
      if (!collidesWithWall(nx, p.y, TANK_RADIUS)) p.x = nx;
      if (!collidesWithWall(p.x, ny, TANK_RADIUS)) p.y = ny;

      // Clamp to world bounds
      p.x = Math.max(TANK_RADIUS, Math.min(MAP_W - TANK_RADIUS, p.x));
      p.y = Math.max(TANK_RADIUS, Math.min(MAP_H - TANK_RADIUS, p.y));

      p.angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    }

    // Turret always faces where the client's mouse points
    p.turretAngle = inp.turretAngle;

    // ── Firing ────────────────────────────────────────────────
    if (inp.fire && nowMs - p.lastFire >= FIRE_COOLDOWN) {
      p.lastFire = nowMs;
      const rad = (inp.turretAngle - 90) * Math.PI / 180;
      const ox = Math.cos(rad) * 24;
      const oy = Math.sin(rad) * 24;
      state.bullets.push({
        id:          state.nextBulletId++,
        ownerIndex:  i,
        x:           p.x + ox,
        y:           p.y + oy,
        vx:          Math.cos(rad) * BULLET_SPEED,
        vy:          Math.sin(rad) * BULLET_SPEED,
        born:        nowMs,
      });
    }
  }

  // ── Move bullets & check collisions ──────────────────────────
  const surviving = [];
  for (const b of state.bullets) {
    // Expire after 2.2 seconds
    if (nowMs - b.born > 2200) continue;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Out of bounds
    if (b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) continue;

    // Wall hit
    if (collidesWithWall(b.x, b.y, BULLET_RADIUS)) continue;

    // Tank hit — check the enemy (not the shooter)
    let hit = false;
    for (let i = 0; i < 2; i++) {
      if (i === b.ownerIndex) continue;
      const p = state.players[i];
      if (!p.alive) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < (TANK_RADIUS + BULLET_RADIUS) ** 2) {
        p.hp = Math.max(0, p.hp - BULLET_DMG);
        if (p.hp <= 0) p.alive = false;
        hit = true;
        break;
      }
    }
    if (!hit) surviving.push(b);
  }
  state.bullets = surviving;
  state.tick++;

  // ── Check win condition ───────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    if (!state.players[i].alive) {
      state.status = 'over';
      state.winner = i === 0 ? 1 : 0;
      return { winner: state.winner };
    }
  }

  return null;
}

module.exports = { tick, WALLS };
