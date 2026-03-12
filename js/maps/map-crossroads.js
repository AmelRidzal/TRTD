// ================================================================
//  map-crossroads.js  —  "CROSSROADS"  900×900  (tall square map)
//  Four quadrant rooms connected by a central crossroads.
//  Great for duel — balanced sightlines with flanking options.
// ================================================================
const MAP_CROSSROADS = {
  id: 'crossroads', label: 'CROSSROADS', width: 900, height: 900,
  playerSpawn: { x: 450, y: 450 },
  duelSpawns:  [{ x: 160, y: 450 }, { x: 740, y: 450 }],

  build(scene) {
    _buildFloor(scene, this.width, this.height);
    const walls = scene.physics.add.staticGroup();
    const pts = [
      ..._borders(this.width, this.height),

      // ── Vertical corridor dividers ─────────────────────────
      // Left divider (x=300), gap in centre at y=420–480
      [300,80],[300,120],[300,160],[300,200],[300,240],[300,280],[300,320],[300,360],[300,400],
      // gap 440–500
      [300,520],[300,560],[300,600],[300,640],[300,680],[300,720],[300,760],[300,800],

      // Right divider (x=600), same gaps
      [600,80],[600,120],[600,160],[600,200],[600,240],[600,280],[600,320],[600,360],[600,400],
      [600,520],[600,560],[600,600],[600,640],[600,680],[600,720],[600,760],[600,800],

      // ── Horizontal corridor dividers ───────────────────────
      // Top divider (y=300), gap in centre at x=420–480
      [80,300],[120,300],[160,300],[200,300],[240,300],[280,300],
      // gap 320 to 380 (around the vertical walls)
      // left of left divider
      // Already handled — just need right sections
      [340,300],[380,300],[400,300],
      // gap 440-500
      [500,300],[520,300],[560,300],
      [640,300],[680,300],[720,300],[760,300],[800,300],

      // Bottom divider (y=600)
      [80,600],[120,600],[160,600],[200,600],[240,600],[280,600],
      [340,600],[380,600],[400,600],
      [500,600],[520,600],[560,600],
      [640,600],[680,600],[720,600],[760,600],[800,600],

      // ── Inner room corners — pillars in each quadrant ──────
      // Top-left quadrant
      [160,160],[200,160],[160,200],
      // Top-right quadrant
      [700,160],[740,160],[740,200],
      // Bottom-left quadrant
      [160,700],[160,740],[200,740],
      // Bottom-right quadrant
      [700,740],[740,740],[740,700],

      // ── Central island ─────────────────────────────────────
      [420,420],[460,420],[500,420],
      [420,460],[500,460],
      [420,500],[460,500],[500,500],
    ];
    pts.forEach(([x,y]) => { const w=walls.create(x,y,'wall').setDepth(1); w.setImmovable(true); w.refreshBody(); });
    return walls;
  },
};
