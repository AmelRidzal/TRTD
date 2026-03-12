// ================================================================
//  map-fortress.js  —  "FORTRESS"  1200×800  (bigger map)
//  A large map with a central fort and outer ring corridors.
//  Wave mode spawns enemies from all sides.
// ================================================================
const MAP_FORTRESS = {
  id: 'fortress', label: 'FORTRESS', width: 1200, height: 800,
  playerSpawn: { x: 600, y: 400 },
  duelSpawns:  [{ x: 200, y: 400 }, { x: 1000, y: 400 }],

  build(scene) {
    _buildFloor(scene, this.width, this.height);
    const walls = scene.physics.add.staticGroup();
    const pts = [
      ..._borders(this.width, this.height),

      // Central fortress — 5×5 hollow square, centred at 600,400
      // Top wall of fort (y=280), gap in middle
      [440,280],[480,280],[520,280],
      // gap 560–640
      [680,280],[720,280],[760,280],

      // Bottom wall of fort (y=520)
      [440,520],[480,520],[520,520],
      // gap 560–640
      [680,520],[720,520],[760,520],

      // Left wall of fort (x=440), gap in middle
      [440,320],[440,360],
      // gap 400–440
      [440,480],[440,440],

      // Right wall of fort (x=760), gap in middle
      [760,320],[760,360],
      [760,480],[760,440],

      // Fort corners (filled)
      [400,280],[400,320],[400,480],[400,520],
      [800,280],[800,320],[800,480],[800,520],

      // Outer ring — 4 clusters of cover, one per quadrant
      // Top-left
      [200,200],[240,200],[200,240],
      // Top-right
      [960,200],[1000,200],[1000,240],
      // Bottom-left
      [200,600],[240,600],[200,560],
      // Bottom-right
      [960,600],[1000,600],[1000,560],

      // Mid-lane pillars (create interesting movement paths)
      [320,400],[360,400],
      [840,400],[880,400],
      [600,200],[600,240],
      [600,560],[600,600],

      // Diagonal scatter — top half
      [200,400],[240,360],
      [960,400],[1000,360],
      // Bottom half
      [200,440],[240,480],
      [960,440],[1000,480],
    ];
    pts.forEach(([x,y]) => { const w=walls.create(x,y,'wall').setDepth(1); w.setImmovable(true); w.refreshBody(); });
    return walls;
  },
};
