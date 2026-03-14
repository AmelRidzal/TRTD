// ================================================================
//  map-ffa2.js  —  "CROSSFIRE"  2400×1600
//  True diagonal walls defined as {x1,y1,x2,y2} line segments.
//  Physics and rendering both use segments — no staircase approximation.
// ================================================================

const MAP_FFA3 = {
  id: 'ffa3', label: 'FFA3', width: 2400, height: 1600,
  isFFA: true,

  spawns: [
    {x: 535,  y: 140},  {x: 1440,  y: 280},  {x: 2240, y: 120},
    {x: 150,  y: 600},  {x: 1900, y: 500},
    {x: 670, y: 920}, {x: 1400, y: 820},
    {x: 160,  y: 1480}, {x: 1200, y: 1480}, {x: 2240, y: 1280},
  ],

  get walls() {
    const W = 2400, H = 1600;
    return [
      // Border
      {x1:0,y1:0,x2:W,y2:0},
      {x1:W,y1:0,x2:W,y2:H},
      {x1:W,y1:H,x2:0,y2:H},
      {x1:0,y1:H,x2:0,y2:0},

      {x1:240,y1:240,x2:1000,y2:600},
      {x1:1400,y1:1000,x2:2160,y2:1360},

      {x1:240,y1:800,x2:1200,y2:240},
      {x1:1200,y1:1360,x2:2160,y2:800},

      
      {x1:240,y1:1360,x2:600,y2:1150},
      {x1:800,y1:1033,x2:1400,y2:683},
      {x1:1600,y1:566,x2:2160,y2:240},

      {x1:50,y1:50,x2:150,y2:50},
      {x1:50,y1:50,x2:50,y2:150},
      {x1:150,y1:50,x2:150,y2:150},
      {x1:50,y1:150,x2:150,y2:150},


      {x1:750,y1:400,x2:850,y2:400},
      {x1:750,y1:400,x2:750,y2:500},
      {x1:850,y1:400,x2:850,y2:500},
      {x1:750,y1:500,x2:850,y2:500},

      {x1:1000,y1:150,x2:1100,y2:150},
      {x1:1000,y1:150,x2:1000,y2:250},
      {x1:1100,y1:150,x2:1100,y2:250},
      {x1:1000,y1:250,x2:1100,y2:250},

      {x1:1600,y1:300,x2:1700,y2:300},
      {x1:1600,y1:300,x2:1600,y2:400},
      {x1:1700,y1:300,x2:1700,y2:400},
      {x1:1600,y1:400,x2:1700,y2:400},

      {x1:1800,y1:700,x2:1900,y2:700},
      {x1:1800,y1:700,x2:1800,y2:800},
      {x1:1900,y1:700,x2:1900,y2:800},
      {x1:1800,y1:800,x2:1900,y2:800},

      {x1:300,y1:500,x2:400,y2:500},
      {x1:300,y1:500,x2:300,y2:600},
      {x1:400,y1:500,x2:400,y2:600},
      {x1:300,y1:600,x2:400,y2:600},

      {x1:650,y1:1400,x2:750,y2:1400},
      {x1:650,y1:1400,x2:650,y2:1500},
      {x1:750,y1:1400,x2:750,y2:1500},
      {x1:650,y1:1500,x2:750,y2:1500},

      {x1:950,y1:700,x2:1050,y2:700},
      {x1:950,y1:700,x2:950,y2:800},
      {x1:1050,y1:700,x2:1050,y2:800},
      {x1:950,y1:800,x2:1050,y2:800},

      {x1:1150,y1:1100,x2:1050,y2:1100},
      {x1:1150,y1:1100,x2:1150,y2:1000},
      {x1:1050,y1:1100,x2:1050,y2:1000},
      {x1:1150,y1:1000,x2:1050,y2:1000},

      {x1:100,y1:1000,x2:200,y2:1000},
      {x1:100,y1:1000,x2:100,y2:1100},
      {x1:200,y1:1000,x2:200,y2:1100},
      {x1:100,y1:1100,x2:200,y2:1100},

      {x1:1900,y1:50,x2:2000,y2:50},
      {x1:1900,y1:50,x2:1900,y2:150},
      {x1:2000,y1:50,x2:2000,y2:150},
      {x1:1900,y1:150,x2:2000,y2:150},
      
      {x1:1850,y1:950,x2:1950,y2:950},
      {x1:1850,y1:950,x2:1850,y2:1050},
      {x1:1950,y1:950,x2:1950,y2:1050},
      {x1:1850,y1:1050,x2:1950,y2:1050},

      {x1:1750,y1:1580,x2:1850,y2:1580},
      {x1:1750,y1:1580,x2:1750,y2:1480},
      {x1:1850,y1:1580,x2:1850,y2:1480},
      {x1:1750,y1:1480,x2:1850,y2:1480},

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
