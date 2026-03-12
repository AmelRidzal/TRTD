// ================================================================
//  map-corridor.js  —  "CORRIDOR"  900×600
//  Three horizontal lanes divided by long walls with gaps.
//  Fast, intense — forces close-quarters combat.
// ================================================================
const MAP_CORRIDOR = {
  id: 'corridor', label: 'CORRIDOR', width: 900, height: 600,
  playerSpawn: { x: 450, y: 300 },
  duelSpawns:  [{ x: 160, y: 300 }, { x: 740, y: 300 }],

  build(scene) {
    _buildFloor(scene, this.width, this.height);
    const walls = scene.physics.add.staticGroup();
    const pts = [
      ..._borders(this.width, this.height),

      // Top lane divider — long wall with two gaps
      [120,200],[160,200],[200,200],[240,200],[280,200],
      // gap at 320
      [360,200],[400,200],[440,200],[480,200],[520,200],
      // gap at 560
      [600,200],[640,200],[680,200],[720,200],[760,200],

      // Bottom lane divider — mirrored
      [120,400],[160,400],[200,400],[240,400],[280,400],
      // gap at 320
      [360,400],[400,400],[440,400],[480,400],[520,400],
      // gap at 560
      [600,400],[640,400],[680,400],[720,400],[760,400],

      // Central pillars
      [440,300],[460,300],

      // Side alcoves
      [120,120],[120,160],
      [780,120],[780,160],
      [120,440],[120,480],
      [780,440],[780,480],
    ];
    pts.forEach(([x,y]) => { const w=walls.create(x,y,'wall').setDepth(1); w.setImmovable(true); w.refreshBody(); });
    return walls;
  },
};
