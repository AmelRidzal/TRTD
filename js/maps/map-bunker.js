// ================================================================
//  map-bunker.js  —  "BUNKER"  1100×700  (bigger map)
//  A sprawling bunker with rooms, doorways and tight choke points.
//  Rewards map knowledge — many ambush spots.
// ================================================================
const MAP_BUNKER = {
  id: 'bunker', label: 'BUNKER', width: 1100, height: 700,
  playerSpawn: { x: 550, y: 350 },
  duelSpawns:  [{ x: 180, y: 350 }, { x: 920, y: 350 }],

  build(scene) {
    _buildFloor(scene, this.width, this.height);
    const walls = scene.physics.add.staticGroup();
    const pts = [
      ..._borders(this.width, this.height),

      // ── Left room (top-left quadrant) ──────────────────────
      // Right wall of left room, gap for door at y=200
      [260,120],[260,160],
      // gap 200–240
      [260,280],[260,320],[260,360],

      // ── Right room (top-right quadrant) ────────────────────
      [840,120],[840,160],
      // gap 200–240
      [840,280],[840,320],[840,360],

      // ── Bottom room (bottom-left) ───────────────────────────
      [260,380],[260,420],
      // gap 460–500
      [260,540],[260,580],

      // ── Bottom room (bottom-right) ──────────────────────────
      [840,380],[840,420],
      [840,540],[840,580],

      // ── Top corridor divider ────────────────────────────────
      [340,240],[380,240],[420,240],[460,240],
      // gap 500–540
      [580,240],[620,240],[660,240],[700,240],[740,240],

      // ── Bottom corridor divider ─────────────────────────────
      [340,460],[380,460],[420,460],[460,460],
      // gap 500–540
      [580,460],[620,460],[660,460],[700,460],[740,460],

      // ── Central cross ───────────────────────────────────────
      // Horizontal bar, gaps on sides
      [420,340],[460,340],[500,340],
      // gap 540–580
      [620,340],[660,340],[700,340],

      // Vertical bar, gaps top/bottom
      [540,260],[540,300],
      // gap 340
      [540,380],[540,420],

      // ── Scatter pillars ─────────────────────────────────────
      [140,260],[140,300],[140,400],[140,440],
      [960,260],[960,300],[960,400],[960,440],
      [340,120],[380,120],[700,120],[740,120],
      [340,580],[380,580],[700,580],[740,580],
    ];
    pts.forEach(([x,y]) => { const w=walls.create(x,y,'wall').setDepth(1); w.setImmovable(true); w.refreshBody(); });
    return walls;
  },
};
