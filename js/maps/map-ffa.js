// ================================================================
//  map-ffa.js  —  "WARZONE"  2400×1600
//  Large FFA arena. Thin walls = {x,y,w,h} rects, not tile pts.
//  Camera follows player at 1.5x zoom showing ~800x533 of world.
// ================================================================

const MAP_FFA = {
  id: 'ffa', label: 'WARZONE', width: 2400, height: 1600,
  isFFA: true,

  // 12 spread-out spawn points (must match server.js FFA_SPAWNS)
  spawns: [
    {x:200,  y:200},  {x:1200, y:180},  {x:2200, y:200},
    {x:180,  y:800},  {x:600,  y:500},  {x:1200, y:800},
    {x:1800, y:500},  {x:2220, y:800},  {x:200,  y:1400},
    {x:800,  y:1300}, {x:1600, y:1300}, {x:2200, y:1400},
  ],

  get walls() {
    const r = [], T = 10, W = 2400, H = 1600;
    r.push({x:0,y:0,w:W,h:T},{x:0,y:H-T,w:W,h:T},
           {x:0,y:0,w:T,h:H},{x:W-T,y:0,w:T,h:H});
    [[60,400,600],[900,400,300],[1500,400,300],[1900,400,440],
     [60,800,350],[550,800,500],[1200,800,200],[1600,800,500],[2250,800,90],
     [60,1200,600],[900,1200,300],[1500,1200,300],[1900,1200,440]
    ].forEach(([x,y,w])=>r.push({x,y,w,h:T}));
    [[600,60,280],[600,460,280],[600,860,280],[600,1260,280],
     [1200,60,280],[1200,460,280],[1200,860,280],[1200,1260,280],
     [1800,60,280],[1800,460,280],[1800,860,280],[1800,1260,280]
    ].forEach(([x,y,h])=>r.push({x,y,w:T,h}));
    r.push(
      {x:1000,y:680,w:400,h:T},{x:1000,y:920,w:400,h:T},
      {x:1000,y:680,w:T,h:120},{x:1000,y:820,w:T,h:100},
      {x:1400,y:680,w:T,h:120},{x:1400,y:820,w:T,h:100},
      {x:250,y:180,w:150,h:T},{x:250,y:180,w:T,h:150},
      {x:2000,y:180,w:150,h:T},{x:2150,y:180,w:T,h:150},
      {x:250,y:1420,w:150,h:T},{x:250,y:1270,w:T,h:150},
      {x:2000,y:1420,w:150,h:T},{x:2150,y:1270,w:T,h:150}
    );
    [[400,600],[800,220],[1200,500],[1600,220],[2000,600],
     [400,1000],[800,1380],[1200,1100],[1600,1380],[2000,1000],[700,800],[1700,800]
    ].forEach(([px,py])=>{
      r.push({x:px-30,y:py-30,w:60,h:T},{x:px-30,y:py+20,w:60,h:T},
             {x:px-30,y:py-30,w:T,h:60},{x:px+20,y:py-30,w:T,h:60});
    });
    return r;
  },

  build(scene) {
    const W = this.width, H = this.height;
    const gfx = scene.add.graphics().setDepth(0);
    gfx.fillStyle(0x06060f); gfx.fillRect(0,0,W,H);
    gfx.lineStyle(1, 0x0e0e24, 0.6);
    for (let x=0; x<W; x+=80) gfx.lineBetween(x,0,x,H);
    for (let y=0; y<H; y+=80) gfx.lineBetween(0,y,W,y);

    const wg = scene.add.graphics().setDepth(2);
    for (const r of this.walls) {
      wg.fillStyle(0x1a1a40,1); wg.fillRect(r.x,r.y,r.w,r.h);
      wg.lineStyle(1,0x3030aa,0.8); wg.strokeRect(r.x,r.y,r.w,r.h);
    }

    const group = scene.physics.add.staticGroup();
    for (const r of this.walls) {
      const body = scene.add.rectangle(r.x+r.w/2, r.y+r.h/2, r.w, r.h).setVisible(false);
      scene.physics.add.existing(body, true);
      group.add(body);
    }

    const sg = scene.add.graphics().setDepth(1);
    sg.lineStyle(1,0x00e5ff,0.15);
    for (const sp of this.spawns) sg.strokeCircle(sp.x,sp.y,32);

    return group;
  },
};
