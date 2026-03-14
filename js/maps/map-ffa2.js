// ================================================================
//  map-ffa2.js  —  "CROSSFIRE"  2400×1600
//  True diagonal walls defined as {x1,y1,x2,y2} line segments.
//  Physics and rendering both use segments — no staircase approximation.
// ================================================================

const MAP_FFA2 = {
  id: 'ffa2', label: 'CROSSFIRE', width: 2400, height: 1600,
  isFFA: true,

  spawns: [
    {x: 160,  y: 120},  {x: 840,  y: 120},  {x: 2240, y: 120},
    {x: 480,  y: 340},  {x: 1200, y: 280},  {x: 1900, y: 340},
    {x: 260,  y: 800},  {x: 2150, y: 800},
    {x: 160,  y: 1480}, {x: 1200, y: 1420}, {x: 2240, y: 1480},
  ],

  get walls() {
    const W = 2400, H = 1600;
    return [
      // Border
      {x1:0,y1:0,x2:W,y2:0},
      {x1:W,y1:0,x2:W,y2:H},
      {x1:W,y1:H,x2:0,y2:H},
      {x1:0,y1:H,x2:0,y2:0},

      // Top-left cluster
      {x1:180,y1:160,x2:390,y2:360},   // \
      {x1:680,y1:160,x2:480,y2:360},   // /

      // Top-centre horizontal
      {x1:900,y1:130,x2:1400,y2:130},

      // Top-right cluster
      {x1:1820,y1:160,x2:2030,y2:360}, // \
      {x1:2280,y1:160,x2:2080,y2:360}, // /

      // Mid-left diagonal pair
      {x1:60, y1:500,x2:310,y2:740},   // \
      {x1:540,y1:500,x2:290,y2:740},   // /

      // Centre-left horizontal
      {x1:60, y1:780,x2:480,y2:780},

      // Centre horizontal
      {x1:700,y1:500,x2:1020,y2:500},

      // Centre X crossing
      {x1:1000,y1:400,x2:1250,y2:640}, // \
      {x1:1450,y1:400,x2:1200,y2:640}, // /

      // Centre-right horizontal
      {x1:1920,y1:780,x2:2340,y2:780},

      // Mid-right diagonal pair
      {x1:1990,y1:500,x2:2240,y2:740}, // \
      {x1:2380,y1:500,x2:2130,y2:740}, // /

      // Lower-left
      {x1:120,y1:900,x2:370,y2:1140},  // \
      {x1:600,y1:900,x2:350,y2:1140},  // /

      // Lower-centre
      {x1:700, y1:1100,x2:1020,y2:1100},
      {x1:1000,y1:950, x2:1250,y2:1190}, // \
      {x1:1450,y1:950, x2:1200,y2:1190}, // /

      // Lower-right
      {x1:1950,y1:900,x2:2200,y2:1140}, // \
      {x1:2350,y1:900,x2:2100,y2:1140}, // /

      // Bottom horizontals
      {x1:60,  y1:1270,x2:510, y2:1270},
      {x1:900, y1:1320,x2:1450,y2:1320},
      {x1:1890,y1:1270,x2:2340,y2:1270},
    ];
  },

  build(scene) {
    const W = this.width, H = this.height;

    // Background
    const gfx = scene.add.graphics().setDepth(0);
    gfx.fillStyle(0x06060f); gfx.fillRect(0, 0, W, H);
    gfx.lineStyle(1, 0x0e0e24, 0.6);
    for (let x = 0; x < W; x += 80) gfx.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 80) gfx.lineBetween(0, y, W, y);

    // Draw walls as true diagonal lines
    const wg = scene.add.graphics().setDepth(2);
    for (const seg of this.walls) {
      wg.lineStyle(10, 0x1a1a40, 1);
      wg.beginPath(); wg.moveTo(seg.x1,seg.y1); wg.lineTo(seg.x2,seg.y2); wg.strokePath();
      wg.lineStyle(1, 0x3030aa, 0.8);
      wg.beginPath(); wg.moveTo(seg.x1,seg.y1); wg.lineTo(seg.x2,seg.y2); wg.strokePath();
    }

    // Physics: rotated rectangle per segment
    const group = scene.physics.add.staticGroup();
    for (const seg of this.walls) {
      const dx=seg.x2-seg.x1, dy=seg.y2-seg.y1;
      const len=Math.sqrt(dx*dx+dy*dy);
      if(len<1) continue;
      const body = scene.add.rectangle((seg.x1+seg.x2)/2,(seg.y1+seg.y2)/2,len,10).setVisible(false);
      body.setRotation(Math.atan2(dy,dx));
      scene.physics.add.existing(body,true);
      group.add(body);
    }

    // Spawn markers
    const sg = scene.add.graphics().setDepth(1);
    sg.lineStyle(1, 0x00e5ff, 0.15);
    for (const sp of this.spawns) sg.strokeCircle(sp.x, sp.y, 32);

    return group;
  },
};
