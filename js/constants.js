// ================================================================
//  constants.js
//  All game-wide tuning values live here.
//  Change a number here and it affects every mode and map.
// ================================================================

// ── Canvas / world size ──────────────────────────────────────────
const MAP_W = 900;
const MAP_H = 600;

// ── Player ───────────────────────────────────────────────────────
const MAX_HP          = 100;
const PLAYER_SPEED    = 170;
const BULLET_SPEED    = 530;
const FIRE_COOLDOWN   = 270;   // ms between player shots

// ── Combat ───────────────────────────────────────────────────────
const BULLET_DMG_TO_ENEMY = 34;

// ── Difficulty presets ───────────────────────────────────────────
//  Each key matches a data-d="..." attribute on the diff cards in HTML.
//  To add a new difficulty, just add a new entry here and a card in index.html.
const DIFFS = {
  easy: {
    enemySpeed:    75,
    enemyHp:       55,
    enemyDmg:      10,
    fireCd:      2400,   // ms between enemy shots
    spawnInterval: 900,  // ms between enemy spawns
    waveBase:        3,  // enemies in wave 1
    waveGrow:      0.5,  // extra enemies added per wave
  },
  normal: {
    enemySpeed:   105,
    enemyHp:       75,
    enemyDmg:      18,
    fireCd:      1600,
    spawnInterval: 700,
    waveBase:        4,
    waveGrow:      0.8,
  },
  hard: {
    enemySpeed:   145,
    enemyHp:       95,
    enemyDmg:      26,
    fireCd:      1100,
    spawnInterval: 520,
    waveBase:        5,
    waveGrow:      1.1,
  },
  insane: {
    enemySpeed:   190,
    enemyHp:      115,
    enemyDmg:      36,
    fireCd:        700,
    spawnInterval: 380,
    waveBase:        6,
    waveGrow:      1.5,
  },
};
