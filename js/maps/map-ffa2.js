// ================================================================
//  map-ffa2.js  —  "CROSSFIRE"  2400×1600
//  Diagonal-feel map with angled wall clusters and open centre.
//  Walls are thin AABB rects arranged in diagonal chains.
// ================================================================

const MAP_FFA2 = {
  id: 'ffa2', label: 'CROSSFIRE', width: 2400, height: 1600,
  isFFA: true,

  // 11 spawn points matching the red circles in the sketch
  spawns: [
    {x: 160,  y: 120},  {x: 840,  y: 120},  {x: 2240, y: 120},
    {x: 480,  y: 340},  {x: 1200, y: 280},  {x: 1900, y: 340},
    {x: 260,  y: 800},                        {x: 2150, y: 800},
    {x: 160,  y: 1480}, {x: 1200, y: 1320}, {x: 2240, y: 1480},
  ],

  get walls() {
    const r = [], T = 12, W = 2400, H = 1600;

    // Border
    r.push(
      {x:0,   y:0,   w:W,  h:T},
      {x:0,   y:H-T, w:W,  h:T},
      {x:0,   y:0,   w:T,  h:H},
      {x:W-T, y:0,   w:T,  h:H}
    );

    // Helper: diagonal chain — a line of short rects stepping diagonally
    // dir: 1 = top-left to bottom-right, -1 = top-right to bottom-left
    // Each segment: 60px long, 12px wide, stepping 50px across & 50px down
    function diag(startX, startY, steps, dir) {
      for (let i = 0; i < steps; i++) {
        const cx = startX + i * 50 * dir;
        const cy = startY + i * 50;
        // Rotated ~45° using two overlapping rects
        r.push({x: cx,      y: cy,      w: 55, h: T});
        r.push({x: cx+T*dir, y: cy+T,   w: T,  h: 30});
      }
    }

    // Top-left cluster (2 diagonal walls crossing)
    diag(180,  160, 4,  1);   // \
    diag(480,  160, 4, -1);   // /

    // Top-centre horizontal break wall
    r.push({x: 900, y: 130, w: 500, h: T});

    // Top-right cluster
    diag(1820, 160, 4,  1);  // \
    diag(2100, 160, 4, -1);  // /

    // Mid-left diagonal pair
    diag(60,   500, 5,  1);  // \
    diag(350,  500, 5, -1);  // /

    // Centre-left horizontal
    r.push({x: 60,   y: 780, w: 420, h: T});

    // Centre horizontal long wall
    r.push({x: 700,  y: 500, w: 320, h: T});

    // Centre cluster — X crossing
    diag(1000, 400, 5,  1);  // \
    diag(1250, 400, 5, -1);  // /

    // Centre-right horizontal
    r.push({x: 1920, y: 780, w: 420, h: T});

    // Mid-right diagonal pair
    diag(1990, 500, 5,  1);  // \
    diag(2250, 500, 5, -1);  // /

    // Lower-left diagonal
    diag(120,  900, 5,  1);
    diag(420,  900, 5, -1);

    // Lower-centre pair
    r.push({x: 700,  y: 1100, w: 320, h: T});
    diag(1000, 950,  5,  1);
    diag(1250, 950,  5, -1);

    // Lower-right diagonal
    diag(1950, 900,  5,  1);
    diag(2200, 900,  5, -1);

    // Bottom-left horizontal
    r.push({x: 60,   y: 1270, w: 450, h: T});

    // Bottom-centre
    r.push({x: 900,  y: 1320, w: 550, h: T});

    // Bottom-right horizontal
    r.push({x: 1890, y: 1270, w: 450, h: T});

    return r;
  },

  build(scene) {
    const W = this.width, H = this.height;

    // Background
    const gfx = scene.add.graphics().setDepth(0);
    gfx.fillStyle(0x06060f); gfx.fillRect(0, 0, W, H);
    gfx.lineStyle(1, 0x0e0e24, 0.6);
    for (let x = 0; x < W; x += 80) gfx.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 80) gfx.lineBetween(0, y, W, y);

    // Walls
    const wg = scene.add.graphics().setDepth(2);
    for (const r of this.walls) {
      wg.fillStyle(0x1a1a40, 1); wg.fillRect(r.x, r.y, r.w, r.h);
      wg.lineStyle(1, 0x3030aa, 0.8); wg.strokeRect(r.x, r.y, r.w, r.h);
    }

    // Physics
    const group = scene.physics.add.staticGroup();
    for (const r of this.walls) {
      const body = scene.add.rectangle(r.x + r.w/2, r.y + r.h/2, r.w, r.h).setVisible(false);
      scene.physics.add.existing(body, true);
      group.add(body);
    }

    // Spawn markers
    const sg = scene.add.graphics().setDepth(1);
    sg.lineStyle(1, 0x00e5ff, 0.15);
    for (const sp of this.spawns) sg.strokeCircle(sp.x, sp.y, 32);

    return group;
  },
};
