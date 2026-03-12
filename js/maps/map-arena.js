// ================================================================
//  maps/map-arena.js  —  "Arena" map
//
//  A map is just an object with a build(scene) method.
//  build() must:
//    - Render floor tiles
//    - Create and return a Phaser StaticGroup of wall sprites
//
//  To add a new map:
//    1. Copy this file, rename it (e.g. map-maze.js)
//    2. Change MAP_ARENA.id and MAP_ARENA.label
//    3. Replace the wall coords array with your new layout
//    4. Add a <script> tag for it in index.html (before main.js)
//    5. Add it to the MAPS registry in main.js
// ================================================================

const MAP_ARENA = {
  id:    'arena',
  label: 'Arena',

  /**
   * Builds the map inside a Phaser scene.
   * @param {Phaser.Scene} scene
   * @returns {Phaser.Physics.Arcade.StaticGroup} walls
   */
  build(scene) {
    // ── Floor ─────────────────────────────────────────────────
    for (let x = 0; x < MAP_W; x += 40)
      for (let y = 0; y < MAP_H; y += 40)
        scene.add.image(x + 20, y + 20, 'floor').setDepth(0);

    // ── Walls ─────────────────────────────────────────────────
    const walls = scene.physics.add.staticGroup();

    const pts = [
      ...MAP_ARENA._borders(),

      // Interior — symmetric obstacle layout.
      // Each pair is [centerX, centerY] of a 40×40 wall tile.
      // Mirror left↔right around x = 450 and top↔bottom around y = 300.
      [200, 160], [200, 200], [200, 240],
      [200, 360], [200, 400], [200, 440],
      [700, 160], [700, 200], [700, 240],
      [700, 360], [700, 400], [700, 440],

      [360, 240], [400, 240], [440, 240],
      [360, 360], [400, 360], [440, 360],
      [360, 300], [440, 300],

      [120, 280], [120, 320],
      [780, 280], [780, 320],

      [280, 120], [320, 120], [560, 120], [600, 120],
      [280, 480], [320, 480], [560, 480], [600, 480],
    ];

    pts.forEach(([x, y]) => {
      const w = walls.create(x, y, 'wall').setDepth(1);
      w.setImmovable(true);
      w.refreshBody();
    });

    return walls;
  },

  /** @private Returns [x,y] pairs for all border wall tiles. */
  _borders() {
    const p = [];
    for (let x = 0; x < MAP_W; x += 40) {
      p.push([x + 20, 20]);
      p.push([x + 20, MAP_H - 20]);
    }
    for (let y = 40; y < MAP_H - 40; y += 40) {
      p.push([20,         y + 20]);
      p.push([MAP_W - 20, y + 20]);
    }
    return p;
  },
};
