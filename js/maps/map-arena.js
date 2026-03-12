// ================================================================
//  map-arena.js  —  "ARENA"  900×600  Classic symmetric layout
// ================================================================
const MAP_ARENA = {
  id: 'arena', label: 'ARENA', width: 900, height: 600,
  playerSpawn: { x: 450, y: 300 },
  duelSpawns:  [{ x: 180, y: 300 }, { x: 720, y: 300 }],

  build(scene) {
    _buildFloor(scene, this.width, this.height);
    const walls = scene.physics.add.staticGroup();
    const pts = [
      ..._borders(this.width, this.height),
      [200,160],[200,200],[200,240],[200,360],[200,400],[200,440],
      [700,160],[700,200],[700,240],[700,360],[700,400],[700,440],
      [360,240],[400,240],[440,240],
      [360,360],[400,360],[440,360],
      [360,300],[440,300],
      [120,280],[120,320],[780,280],[780,320],
      [280,120],[320,120],[560,120],[600,120],
      [280,480],[320,480],[560,480],[600,480],
    ];
    pts.forEach(([x,y]) => { const w=walls.create(x,y,'wall').setDepth(1); w.setImmovable(true); w.refreshBody(); });
    return walls;
  },
};
