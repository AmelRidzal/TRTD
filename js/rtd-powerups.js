// ================================================================
//  rtd-powerups.js  —  Roll The Dice powerup/down definitions
//  Each entry is applied server-side via rtdApplyEffect()
//  and described client-side for the animation banner.
// ================================================================

const RTD_EFFECTS = [
  {
    id: 'double_fire',
    label: '🔥 DOUBLE FIRE RATE',
    desc: 'Your fire rate is doubled for 15 seconds!',
    color: '#ff6600',
    duration: 15000,
    good: true,
  },
  {
    id: 'double_hp',
    label: '💚 DOUBLE HEALTH',
    desc: 'Your max HP is doubled for 15 seconds!',
    color: '#44ff88',
    duration: 15000,
    good: true,
  },
  {
    id: 'wallhack',
    label: '👻 GHOST BULLETS',
    desc: 'Your bullets pass through walls for 15 seconds!',
    color: '#aa44ff',
    duration: 15000,
    good: true,
  },
  {
    id: 'bouncy',
    label: '🎱 BOUNCY BULLETS',
    desc: 'Your bullets bounce off walls for 15 seconds!',
    color: '#00e5ff',
    duration: 15000,
    good: true,
  },
  {
    id: 'half_fire',
    label: '🐢 HALF FIRE RATE',
    desc: 'Your fire rate is halved for 15 seconds!',
    color: '#ff4060',
    duration: 15000,
    good: false,
  },
  {
    id: 'half_speed',
    label: '⛓️ HALF SPEED',
    desc: 'You move at half speed for 15 seconds!',
    color: '#ff4060',
    duration: 15000,
    good: false,
  },
];

// Lookup by id — used client-side to find label/color for animation
const RTD_BY_ID = Object.fromEntries(RTD_EFFECTS.map(e => [e.id, e]));
