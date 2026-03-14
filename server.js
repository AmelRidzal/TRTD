// ================================================================
//  server.js  —  Tank Commander game server
//  Zero external dependencies — uses only Node.js built-ins.
//
//  Run:  node server.js
//  Then open:  http://localhost:3000
// ================================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws'); // only dep

// ── Paths ─────────────────────────────────────────────────────────
const SERVER_DIR = fs.realpathSync(path.dirname(process.argv[1]));
const GAME_DIR = SERVER_DIR;  // server.js is now in root alongside index.html
const PORT       = process.env.PORT || 3000;
const TICK_MS    = 33; // ~30 Hz

console.log('[server] Game files:', GAME_DIR);

// ── MIME types ────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ── Static file handler (replaces express.static) ─────────────────
function serveStatic(req, res) {
  if (req.method !== 'GET') return false;

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.resolve(GAME_DIR, '.' + urlPath);
  if (!filePath.startsWith(GAME_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(data);
  return true;
}

// ── Lobby manager ──────────────────────────────────────────────────
const lobbies = new Map();
const CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  let c;
  do { c = Array.from({length:4}, () => CHARS[Math.floor(Math.random()*CHARS.length)]).join(''); }
  while (lobbies.has(c));
  return c;
}

function getLobby(code)  { return lobbies.get(code) || null; }
function destroyLobby(code) {
  const l = lobbies.get(code);
  if (!l) return;
  if (l.tickInterval) clearInterval(l.tickInterval);
  lobbies.delete(code);
  console.log('[lobby] Destroyed:', code);
}
function bcast(lobby, msg) {
  const d = JSON.stringify(msg);
  for (const s of lobby.sockets)
    if (s && s.readyState === WebSocket.OPEN) s.send(d);
}
function wsend(s, msg) {
  if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(msg));
}

// ── Game constants (must match client) ────────────────────────────
const PLAYER_SPEED=170, BULLET_SPEED=530;
const FIRE_CD=270, BULLET_DMG=34, BULLET_R=5, TANK_R=16;
const TILE=40;

// ── Map definitions ────────────────────────────────────────────────
function borderPts(w,h) {
  const p=[];
  for(let x=0;x<w;x+=TILE){p.push([x+20,20]);p.push([x+20,h-20]);}
  for(let y=TILE;y<h-TILE;y+=TILE){p.push([20,y+20]);p.push([w-20,y+20]);}
  return p;
}
function ptsToWalls(pts,w,h) {
  return pts.map(([cx,cy])=>({x:cx-TILE/2,y:cy-TILE/2,w:TILE,h:TILE}));
}

const MAP_DEFS = {
  arena: {
    width:900, height:600,
    duelSpawns:[{x:180,y:300},{x:720,y:300}],
    wallPts(){return[...borderPts(900,600),
      [200,160],[200,200],[200,240],[200,360],[200,400],[200,440],
      [700,160],[700,200],[700,240],[700,360],[700,400],[700,440],
      [360,240],[400,240],[440,240],[360,360],[400,360],[440,360],
      [360,300],[440,300],[120,280],[120,320],[780,280],[780,320],
      [280,120],[320,120],[560,120],[600,120],[280,480],[320,480],[560,480],[600,480]];}
  },
  corridor: {
    width:900, height:600,
    duelSpawns:[{x:160,y:300},{x:740,y:300}],
    wallPts(){return[...borderPts(900,600),
      [120,200],[160,200],[200,200],[240,200],[280,200],
      [360,200],[400,200],[440,200],[480,200],[520,200],
      [600,200],[640,200],[680,200],[720,200],[760,200],
      [120,400],[160,400],[200,400],[240,400],[280,400],
      [360,400],[400,400],[440,400],[480,400],[520,400],
      [600,400],[640,400],[680,400],[720,400],[760,400],
      [440,300],[460,300],
      [120,120],[120,160],[780,120],[780,160],[120,440],[120,480],[780,440],[780,480]];}
  },
  fortress: {
    width:1200, height:800,
    duelSpawns:[{x:200,y:400},{x:1000,y:400}],
    wallPts(){return[...borderPts(1200,800),
      [440,280],[480,280],[520,280],[680,280],[720,280],[760,280],
      [440,520],[480,520],[520,520],[680,520],[720,520],[760,520],
      [440,320],[440,360],[440,480],[440,440],
      [760,320],[760,360],[760,480],[760,440],
      [400,280],[400,320],[400,480],[400,520],
      [800,280],[800,320],[800,480],[800,520],
      [200,200],[240,200],[200,240],
      [960,200],[1000,200],[1000,240],
      [200,600],[240,600],[200,560],
      [960,600],[1000,600],[1000,560],
      [320,400],[360,400],[840,400],[880,400],
      [600,200],[600,240],[600,560],[600,600],
      [200,400],[240,360],[960,400],[1000,360],
      [200,440],[240,480],[960,440],[1000,480]];}
  },
  bunker: {
    width:1100, height:700,
    duelSpawns:[{x:180,y:350},{x:920,y:350}],
    wallPts(){return[...borderPts(1100,700),
      [260,120],[260,160],[260,280],[260,320],[260,360],
      [840,120],[840,160],[840,280],[840,320],[840,360],
      [260,380],[260,420],[260,540],[260,580],
      [840,380],[840,420],[840,540],[840,580],
      [340,240],[380,240],[420,240],[460,240],
      [580,240],[620,240],[660,240],[700,240],[740,240],
      [340,460],[380,460],[420,460],[460,460],
      [580,460],[620,460],[660,460],[700,460],[740,460],
      [420,340],[460,340],[500,340],[620,340],[660,340],[700,340],
      [540,260],[540,300],[540,380],[540,420],
      [140,260],[140,300],[140,400],[140,440],
      [960,260],[960,300],[960,400],[960,440],
      [340,120],[380,120],[700,120],[740,120],
      [340,580],[380,580],[700,580],[740,580]];}
  },
  crossroads: {
    width:900, height:900,
    duelSpawns:[{x:160,y:450},{x:740,y:450}],
    wallPts(){return[...borderPts(900,900),
      [300,80],[300,120],[300,160],[300,200],[300,240],[300,280],[300,320],[300,360],[300,400],
      [300,520],[300,560],[300,600],[300,640],[300,680],[300,720],[300,760],[300,800],
      [600,80],[600,120],[600,160],[600,200],[600,240],[600,280],[600,320],[600,360],[600,400],
      [600,520],[600,560],[600,600],[600,640],[600,680],[600,720],[600,760],[600,800],
      [80,300],[120,300],[160,300],[200,300],[240,300],[280,300],
      [340,300],[380,300],[400,300],[500,300],[520,300],[560,300],
      [640,300],[680,300],[720,300],[760,300],[800,300],
      [80,600],[120,600],[160,600],[200,600],[240,600],[280,600],
      [340,600],[380,600],[400,600],[500,600],[520,600],[560,600],
      [640,600],[680,600],[720,600],[760,600],[800,600],
      [160,160],[200,160],[160,200],
      [700,160],[740,160],[740,200],
      [160,700],[160,740],[200,740],
      [700,740],[740,740],[740,700],
      [420,420],[460,420],[500,420],[420,460],[500,460],[420,500],[460,500],[500,500]];}
  },
};

function circleWall(cx,cy,cr,walls) {
  for (const w of walls) {
    const nx=Math.max(w.x,Math.min(cx,w.x+w.w)), ny=Math.max(w.y,Math.min(cy,w.y+w.h));
    if ((cx-nx)**2+(cy-ny)**2 < cr*cr) return true;
  }
  return false;
}

function makeState(mapId) {
  const def = MAP_DEFS[mapId] || MAP_DEFS.arena;
  const s0  = def.duelSpawns[0], s1 = def.duelSpawns[1];
  const walls = ptsToWalls(def.wallPts());
  return {
    tick:0, status:'playing', winner:null, nextBulletId:0, bullets:[],
    mapWidth: def.width, mapHeight: def.height, walls,
    players:[
      {x:s0.x,y:s0.y,angle:90,turretAngle:90,hp:100,alive:true,lastFire:0,
       input:{up:false,down:false,left:false,right:false,fire:false,turretAngle:90}},
      {x:s1.x,y:s1.y,angle:-90,turretAngle:-90,hp:100,alive:true,lastFire:0,
       input:{up:false,down:false,left:false,right:false,fire:false,turretAngle:-90}},
    ],
  };
}

function tickGame(state, dt, now) {
  if (state.status !== 'playing') return null;

  for (let i=0;i<2;i++) {
    const p=state.players[i]; if (!p.alive) continue;
    const inp=p.input;
    let dx=0,dy=0;
    if (inp.up)    dy-=1; if (inp.down)  dy+=1;
    if (inp.left)  dx-=1; if (inp.right) dx+=1;
    if (dx||dy) {
      const len=Math.sqrt(dx*dx+dy*dy); dx/=len; dy/=len;
      const nx=p.x+dx*PLAYER_SPEED*dt, ny=p.y+dy*PLAYER_SPEED*dt;
      if (!circleWall(nx,p.y,TANK_R,state.walls)) p.x=nx;
      if (!circleWall(p.x,ny,TANK_R,state.walls)) p.y=ny;
      p.x=Math.max(TANK_R,Math.min(state.mapWidth-TANK_R,p.x));
      p.y=Math.max(TANK_R,Math.min(state.mapHeight-TANK_R,p.y));
      p.angle=Math.atan2(dy,dx)*180/Math.PI+90;
    }
    p.turretAngle=inp.turretAngle;
    if (inp.fire && now-p.lastFire>=FIRE_CD) {
      p.lastFire=now;
      const rad=(inp.turretAngle-90)*Math.PI/180;
      // FIX 1: 32px offset (was 24) so bullet spawns clear the tank's wall collision radius
      state.bullets.push({id:state.nextBulletId++,owner:i,
        x:p.x+Math.cos(rad)*12, y:p.y+Math.sin(rad)*12,
        vx:Math.cos(rad)*BULLET_SPEED, vy:Math.sin(rad)*BULLET_SPEED, born:now});
    }
  }

  const alive=[];
  for (const b of state.bullets) {
    if (now-b.born>2200) continue;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if (b.x<0||b.x>state.mapWidth||b.y<0||b.y>state.mapHeight) continue;
    if (circleWall(b.x,b.y,BULLET_R,state.walls)) continue;
    let hit=false;
    for (let i=0;i<2;i++) {
      if (i===b.owner) continue;
      const p=state.players[i]; if (!p.alive) continue;
      if ((b.x-p.x)**2+(b.y-p.y)**2 < (TANK_R+BULLET_R)**2) {
        p.hp=Math.max(0,p.hp-BULLET_DMG);
        if (p.hp<=0) p.alive=false;
        hit=true; break;
      }
    }
    if (!hit) alive.push(b);
  }
  state.bullets=alive; state.tick++;

  for (let i=0;i<2;i++) {
    if (!state.players[i].alive) {
      state.status='over'; state.winner=i===0?1:0;
      return {winner:state.winner};
    }
  }
  return null;
}


// ================================================================
//  FFA — Free-For-All
// ================================================================
const ffaLobbies = new Map();

const FFA_SPEED   = 180, FFA_BSPEED = 560, FFA_FIRE_CD = 520; // doubled from 260
const FFA_DMG     = 34,  FFA_TANK_R = 16,  FFA_BULL_R  = 5;
const FFA_DURATION= 300; // seconds
const FFA_RESPAWN = 3000; // ms
const FFA_W = 2400, FFA_H = 1600, FFA_T = 10;

// Load all FFA map configs — add new maps to maps-config.json only, no server changes needed.
const MAPS_CONFIG   = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'maps-config.json'), 'utf8'));
const FFA_MAP_POOL  = Object.entries(MAPS_CONFIG).map(([id, cfg]) => ({ id, spawns: cfg.spawns }));
const FFA_SPAWNS    = MAPS_CONFIG.ffa.spawns; // fallback

function buildFFAWalls() {
  const r = [];
  r.push({x:0,y:0,w:FFA_W,h:FFA_T},{x:0,y:FFA_H-FFA_T,w:FFA_W,h:FFA_T},
         {x:0,y:0,w:FFA_T,h:FFA_H},{x:FFA_W-FFA_T,y:0,w:FFA_T,h:FFA_H});
  const hSegs=[[60,400,600],[900,400,300],[1500,400,300],[1900,400,440],
    [60,800,350],[550,800,500],[1200,800,200],[1600,800,500],[2250,800,90],
    [60,1200,600],[900,1200,300],[1500,1200,300],[1900,1200,440]];
  for(const[x,y,w]of hSegs)r.push({x,y,w,h:FFA_T});
  const vSegs=[[600,60,280],[600,460,280],[600,860,280],[600,1260,280],
    [1200,60,280],[1200,460,280],[1200,860,280],[1200,1260,280],
    [1800,60,280],[1800,460,280],[1800,860,280],[1800,1260,280]];
  for(const[x,y,h]of vSegs)r.push({x,y,w:FFA_T,h});
  r.push({x:1000,y:680,w:400,h:FFA_T},{x:1000,y:920,w:400,h:FFA_T},
         {x:1000,y:680,w:FFA_T,h:120},{x:1000,y:820,w:FFA_T,h:100},
         {x:1400,y:680,w:FFA_T,h:120},{x:1400,y:820,w:FFA_T,h:100});
  r.push({x:250,y:180,w:150,h:FFA_T},{x:250,y:180,w:FFA_T,h:150},
         {x:2000,y:180,w:150,h:FFA_T},{x:2150,y:180,w:FFA_T,h:150},
         {x:250,y:1420,w:150,h:FFA_T},{x:250,y:1270,w:FFA_T,h:150},
         {x:2000,y:1420,w:150,h:FFA_T},{x:2150,y:1270,w:FFA_T,h:150});
  const pillars=[[400,600],[800,220],[1200,500],[1600,220],[2000,600],
    [400,1000],[800,1380],[1200,1100],[1600,1380],[2000,1000],[700,800],[1700,800]];
  for(const[px,py]of pillars){
    r.push({x:px-30,y:py-30,w:60,h:FFA_T},{x:px-30,y:py+20,w:60,h:FFA_T},
           {x:px-30,y:py-30,w:FFA_T,h:60},{x:px+20,y:py-30,w:FFA_T,h:60});
  }
  return r;
}
const FFA_WALLS = buildFFAWalls();

// ================================================================
//  RTD — Roll The Dice effect definitions (mirrors rtd-powerups.js)
// ================================================================
const RTD_EFFECTS = [
  { id:'machinegun',   duration:15000 },
  { id:'triple_speed', duration:15000 },
  { id:'double_hp',   duration:15000 },
  { id:'wallhack',    duration:15000 },
  { id:'bouncy',      duration:15000 },
  { id:'half_fire',   duration:15000 },
  { id:'half_speed',  duration:15000 },
  { id:'glass_canon', duration:15000 },
];
const RTD_POINTS_PER_KILL = 30; // score per kill (use 3 in prod)
const RTD_ROLL_COST      = 10; // points needed to roll



function ffaCircleWall(cx,cy,cr){
  for(const w of FFA_WALLS){
    const nx=Math.max(w.x,Math.min(cx,w.x+w.w)),ny=Math.max(w.y,Math.min(cy,w.y+w.h));
    if((cx-nx)**2+(cy-ny)**2<cr*cr)return true;
  }
  return false;
}

// FIX 2: pick randomly from all spawns except the closest one to any living player
// (old behaviour always picked the single furthest — safe but totally predictable)
function ffaPickSpawn(players, spawns){
  const spawnList = spawns || FFA_SPAWNS;
  const living=Object.values(players).filter(p=>p&&p.alive);
  if(!living.length)return spawnList[Math.floor(Math.random()*spawnList.length)];
  const scored=spawnList.map(sp=>{
    const minD=Math.min(...living.map(p=>Math.hypot(p.x-sp.x,p.y-sp.y)));
    return{sp,dist:minD};
  });
  // Sort ascending so [0] is the closest (most dangerous) spawn
  scored.sort((a,b)=>a.dist-b.dist);
  // Drop the closest, pick randomly from everything else
  const safePool=scored.length>1 ? scored.slice(1) : scored;
  return safePool[Math.floor(Math.random()*safePool.length)].sp;
}

function ffaMakeCode(){
  let c;
  do{c=Array.from({length:4},()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join('');}
  while(ffaLobbies.has(c)||lobbies.has(c));
  return c;
}

function ffaBcast(lobby,msg){
  const d=JSON.stringify(msg);
  for(const s of Object.values(lobby.sockets))
    if(s&&s.readyState===WebSocket.OPEN)s.send(d);
}

function ffaMakePlayer(idx,x,y){
  return{idx,x,y,angle:0,turretAngle:0,hp:100,alive:true,
    kills:0,deaths:0,points:0,lastFire:0,respawnAt:null,
    effect:null,effectEnd:0,
    input:{up:false,down:false,left:false,right:false,fire:false,turretAngle:0,roll:false}};
}

function ffaStartGame(lobby){
  lobby.status='playing';
  lobby.startTime=Date.now();
  // Pick a random FFA map for this game
  const pickedMap = FFA_MAP_POOL[Math.floor(Math.random()*FFA_MAP_POOL.length)];
  lobby.mapId     = pickedMap.id;
  lobby.mapSpawns = pickedMap.spawns;
  for(const idx of Object.keys(lobby.sockets).map(Number)){
    const sp=ffaPickSpawn(lobby.players, lobby.mapSpawns);
    lobby.players[idx]=ffaMakePlayer(idx,sp.x,sp.y);
  }
  ffaBcast(lobby,{type:'ffa_start',mode:lobby.mode,mapId:lobby.mapId});
  console.log('[ffa] Started lobby',lobby.code,'with',lobby.nextIdx,'players');
  let last=Date.now();
  lobby.tickInterval=setInterval(()=>{
    const now=Date.now(),dt=(now-last)/1000; last=now;
    ffaTick(lobby,dt,now);
    ffaSendState(lobby,now);
    if((now-lobby.startTime)/1000>=FFA_DURATION)ffaEnd(lobby);
  },33);
}

function ffaTick(lobby,dt,now){
  const{players,bullets}=lobby;
  for(const p of Object.values(players)){
    if(!p||p.alive)continue;
    if(p.respawnAt&&now>=p.respawnAt){
      const sp=ffaPickSpawn(players, lobby.mapSpawns);
      p.x=sp.x;p.y=sp.y;p.hp=100;p.alive=true;p.respawnAt=null;
      p.effect=null;p.effectEnd=0;
      const s=lobby.sockets[p.idx];
      if(s&&s.readyState===WebSocket.OPEN)s.send(JSON.stringify({type:'ffa_respawned',x:sp.x,y:sp.y}));
    }
  }
  // ── RTD: handle roll requests ──────────────────────────────────
  if(lobby.mode==='rtd'){
    for(const p of Object.values(players)){
      if(!p||!p.alive)continue;
      if(p.input.roll){
        p.input.roll=false;
        if(p.points >= RTD_ROLL_COST && !p.effect){
          p.points -= RTD_ROLL_COST;
          const eff = RTD_EFFECTS[Math.floor(Math.random()*RTD_EFFECTS.length)];
          p.effect    = eff.id;
          p.effectEnd = now + eff.duration;
          if(eff.id==='double_hp') p.hp = Math.min(p.hp*2, 200);
        if(eff.id==='glass_canon'){ p._hpBeforeGlass = p.hp; p.hp = 1; }
          ffaBcast(lobby,{type:'rtd_rolled',playerIdx:p.idx,effectId:eff.id,duration:eff.duration});
        } else if(!p.effect){
          wsend(lobby.sockets[p.idx],{type:'rtd_no_points',have:p.points,need:RTD_ROLL_COST});
        }
      }
    }
  }

  for(const p of Object.values(players)){
    if(!p||!p.alive)continue;
    const{input:inp}=p;
    let dx=0,dy=0;
    if(inp.up)dy-=1; if(inp.down)dy+=1;
    if(inp.left)dx-=1; if(inp.right)dx+=1;
    if(dx||dy){
      const len=Math.sqrt(dx*dx+dy*dy);dx/=len;dy/=len;
      const spd = p.effect==='triple_speed' ? FFA_SPEED*3
                : p.effect==='half_speed'   ? FFA_SPEED*0.5
                : FFA_SPEED;
      const nx=p.x+dx*spd*dt,ny=p.y+dy*spd*dt;
      if(!ffaCircleWall(nx,p.y,FFA_TANK_R))p.x=nx;
      if(!ffaCircleWall(p.x,ny,FFA_TANK_R))p.y=ny;
      p.x=Math.max(FFA_TANK_R,Math.min(FFA_W-FFA_TANK_R,p.x));
      p.y=Math.max(FFA_TANK_R,Math.min(FFA_H-FFA_TANK_R,p.y));
      p.angle=Math.atan2(dy,dx)*180/Math.PI+90;
    }
    p.turretAngle=inp.turretAngle;

    // ── RTD: expire effects ───────────────────────────────────────
    if(p.effect && now >= p.effectEnd){
      console.log(`[RTD-DEBUG] Effect expired for P${p.idx}: ${p.effect}`);
      const expiredEffect = p.effect;
      p.effect=null; p.effectEnd=0;
      if(expiredEffect==='double_hp'  && p.hp > 100) p.hp = 100;
      if(expiredEffect==='glass_canon') p.hp = Math.min(100, p._hpBeforeGlass || 100);
    }

    // ── RTD: per-tick effect modifiers ───────────────────────────
    if(p.effect==='double_hp' && p.hp < 200) p.hp = Math.min(200, p.hp + 5*dt);
    if(p.effect==='glass_canon') p.hp = 1; // keep pinned at 1

    // ── Fire (with RTD modifiers) ─────────────────────────────────
    const fireCd = p.effect==='machinegun' ? FFA_FIRE_CD/4
                 : p.effect==='half_fire'  ? FFA_FIRE_CD*2
                 : FFA_FIRE_CD;
    if(inp.fire&&now-p.lastFire>=fireCd){
      p.lastFire=now;
      const rad=(inp.turretAngle-90)*Math.PI/180;
      bullets.push({id:lobby.nextBulletId++,owner:p.idx,
        x:p.x+Math.cos(rad)*12,y:p.y+Math.sin(rad)*12,
        vx:Math.cos(rad)*FFA_BSPEED,vy:Math.sin(rad)*FFA_BSPEED,born:now,
        wallhack:     p.effect==='wallhack',
        bouncy:       p.effect==='bouncy',
        glassCannon:  p.effect==='glass_canon'});
    }
  }
  const alive=[];
  for(const b of bullets){
    if(now-b.born>2200)continue;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.x<0||b.x>FFA_W||b.y<0||b.y>FFA_H)continue;
    if(!b.wallhack && ffaCircleWall(b.x,b.y,FFA_BULL_R)){
      if(b.bouncy){
        // Simple bounce: reverse whichever axis is closer to a wall
        const testX = ffaCircleWall(b.x+b.vx*0.033,b.y,FFA_BULL_R);
        const testY = ffaCircleWall(b.x,b.y+b.vy*0.033,FFA_BULL_R);
        if(testX) b.vx=-b.vx;
        if(testY) b.vy=-b.vy;
        if(!testX&&!testY){b.vx=-b.vx;b.vy=-b.vy;}
        b.bounces=(b.bounces||0)+1;
        if(b.bounces>6)continue; // max bounces
      } else { continue; }
    }
    let hit=false;
    for(const p of Object.values(players)){
      if(!p||!p.alive||p.idx===b.owner)continue;
      if((b.x-p.x)**2+(b.y-p.y)**2<(FFA_TANK_R+FFA_BULL_R)**2){
        const dmg = b.glassCannon ? 1000 : FFA_DMG;
        p.hp=Math.max(0,p.hp-dmg);
        if(p.hp<=0){
          p.alive=false;p.deaths++;p.respawnAt=now+FFA_RESPAWN;
          const killer=players[b.owner];
          if(killer){
            killer.kills++;
            killer.points += RTD_POINTS_PER_KILL;
          }
          const s=lobby.sockets[p.idx];
          if(s&&s.readyState===WebSocket.OPEN)
            s.send(JSON.stringify({type:'ffa_killed',respawnIn:FFA_RESPAWN}));
        }
        hit=true;break;
      }
    }
    if(!hit)alive.push(b);
  }
  lobby.bullets=alive;
}

function ffaSendState(lobby,now){
  const timeLeft=Math.max(0,FFA_DURATION-(now-lobby.startTime)/1000);
  const msg={type:'ffa_state',timeLeft,players:{},
    bullets:lobby.bullets.map(b=>({id:b.id,owner:b.owner,x:b.x,y:b.y}))};
  for(const[i,p]of Object.entries(lobby.players)){
    if(!p)continue;
    msg.players[i]={x:p.x,y:p.y,angle:p.angle,turretAngle:p.turretAngle,
                    hp:p.hp,alive:p.alive,kills:p.kills,points:p.points||0,
                    effect:p.effect||null,
                    canRoll: lobby.mode==='rtd' && (p.points>=RTD_ROLL_COST) && !p.effect};
  }
  ffaBcast(lobby,msg);
}

function ffaEnd(lobby){
  if(lobby.status==='over')return;
  lobby.status='over';
  if(lobby.tickInterval){clearInterval(lobby.tickInterval);lobby.tickInterval=null;}
  const lb=Object.values(lobby.players).filter(Boolean)
    .sort((a,b)=>b.kills-a.kills)
    .map(p=>({idx:p.idx,kills:p.kills,deaths:p.deaths}));
  // Send result with the lobby code so clients can reconnect for play-again
  ffaBcast(lobby,{type:'ffa_over',leaderboard:lb,code:lobby.code});
  // Reset lobby to waiting so the same players can start a new game
  lobby.players={};
  lobby.bullets=[];
  lobby.nextBulletId=0;
  lobby.startTime=null;
  lobby.status='waiting';
  console.log('[ffa] Game over, lobby reset to waiting:',lobby.code);
}

setInterval(()=>{
  const cut=Date.now()-15*60*1000;
  for(const[code,l]of ffaLobbies)
    if(l.createdAt<cut&&l.status==='waiting'){
      if(l.tickInterval)clearInterval(l.tickInterval);
      ffaLobbies.delete(code);
    }
},60000);

// ── HTTP server ───────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'POST' && req.url === '/api/lobby/create') {
    const code = makeCode();
    lobbies.set(code, {code, status:'waiting', sockets:[null,null], gameState:null, tickInterval:null, createdAt:Date.now(), rematchVotes:[false,false]});
    console.log('[api] Created:', code);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,code}));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lobby/join') {
    let body='';
    req.on('data', d => body+=d);
    req.on('end', () => {
      try {
        const {code} = JSON.parse(body);
        const lobby  = getLobby((code||'').toUpperCase().trim());
        if (!lobby || lobby.status !== 'waiting') {
          res.writeHead(404,{'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:false,error:'Lobby not found or already started'}));
          return;
        }
        lobby.status = 'ready';
        console.log('[api] Joined:', lobby.code);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,code:lobby.code}));
      } catch(e) {
        res.writeHead(400,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false,error:'Bad request'}));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/ffa/create') {
    let body2='';
    req.on('data', d => body2+=d);
    req.on('end', () => {
      let reqMode='standard';
      try{ const parsed=JSON.parse(body2); reqMode=parsed.mode||'standard'; }catch{}
      const code = ffaMakeCode();
      ffaLobbies.set(code,{code,status:'waiting',mode:reqMode,sockets:{},players:{},
        nextIdx:0,bullets:[],nextBulletId:0,startTime:null,tickInterval:null,createdAt:Date.now()});
      console.log('[ffa] Created lobby:',code,'mode:',reqMode);
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:true,code,mode:reqMode}));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/ffa/join') {
    let body='';
    req.on('data', d => body+=d);
    req.on('end', () => {
      try {
        const { code } = JSON.parse(body);
        const lobby = ffaLobbies.get((code||'').toUpperCase().trim());
        if (!lobby || lobby.status === 'over') {
          res.writeHead(404,{'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:false,error:'Lobby not found or already finished'}));
          return;
        }
        if (lobby.nextIdx >= 8) {
          res.writeHead(404,{'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:false,error:'Lobby is full (8/8)'}));
          return;
        }
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,code:lobby.code,count:lobby.nextIdx,inProgress:lobby.status==='playing'}));
      } catch(e) {
        res.writeHead(400,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false,error:'Bad request'}));
      }
    });
    return;
  }

  if (!serveStatic(req, res)) {
    res.writeHead(404); res.end('Not found: ' + req.url);
  }
});

// ── WebSocket ─────────────────────────────────────────────────────
const wss = new WebSocketServer({server, path:'/game'});

wss.on('connection', (socket, req) => {
  const p      = new URLSearchParams(req.url.replace('/game?',''));
  const code   = (p.get('code')||'').toUpperCase();
  const mode   = p.get('mode') || 'duel';

  if (mode === 'ffa') {
    const ffaLobby = ffaLobbies.get(code);
    if (!ffaLobby || ffaLobby.nextIdx >= 8 || ffaLobby.status === 'over') {
      socket.close(4000,'FFA lobby not found, full, or finished'); return;
    }
    const myIdx = ffaLobby.nextIdx++;
    ffaLobby.sockets[myIdx] = socket;
    const inProgress = ffaLobby.status === 'playing';
    wsend(socket,{type:'ffa_joined',playerIndex:myIdx,code,inProgress,mode:ffaLobby.mode});
    ffaBcast(ffaLobby,{type:'ffa_lobby_update',count:ffaLobby.nextIdx});
    console.log(`[ffa-ws] Player ${myIdx} joined lobby ${code} (${ffaLobby.nextIdx}/8)${inProgress?' [mid-game]':''}`);

    // If game already running, spawn this player immediately
    if (inProgress) {
      const sp = ffaPickSpawn(ffaLobby.players);
      ffaLobby.players[myIdx] = ffaMakePlayer(myIdx, sp.x, sp.y);
      wsend(socket, {type:'ffa_start',mode:ffaLobby.mode,mapId:ffaLobby.mapId||'ffa'});
    }

    socket.on('message', raw => {
      let msg; try{msg=JSON.parse(raw);}catch{return;}
      const lob = ffaLobbies.get(code); if(!lob)return;
      if(msg.type==='ffa_start_game' && myIdx===0 && lob.status==='waiting' && lob.nextIdx>=2){
        if(msg.mode) lob.mode = msg.mode;
        console.log(`[RTD-DEBUG] Starting game  lobby=${lob.code}  mode=${lob.mode}`);
        ffaStartGame(lob);
      }
      if(msg.type==='ffa_input' && lob.players[myIdx]){
        Object.assign(lob.players[myIdx].input, msg.input);
      }
      if(msg.type==='ffa_roll' && lob.players[myIdx]){
        lob.players[myIdx].input.roll = true;
      }
    });

    socket.on('close', ()=>{
      console.log(`[ffa-ws] Player ${myIdx} left ${code}`);
      const lob=ffaLobbies.get(code); if(!lob)return;
      delete lob.sockets[myIdx];
      if(lob.players[myIdx]) lob.players[myIdx].alive=false;
      if(myIdx===0 && lob.status==='waiting'){
        ffaBcast(lob,{type:'ffa_disbanded'});
        if(lob.tickInterval)clearInterval(lob.tickInterval);
        ffaLobbies.delete(code);
      }
    });
    return;
  }

  const idx   = parseInt(p.get('player')||'0',10);
  const lobby = getLobby(code);

  if (!lobby) { socket.close(4000,'Lobby not found'); return; }

  lobby.sockets[idx] = socket;
  console.log(`[ws] Player ${idx} connected to lobby ${code}`);
  wsend(socket, {type:'connected', playerIndex:idx, code});

  const both = lobby.sockets[0]?.readyState===WebSocket.OPEN
            && lobby.sockets[1]?.readyState===WebSocket.OPEN;
  if (both && lobby.status==='ready') bcast(lobby, {type:'lobby_ready'});

  socket.on('message', raw => {
    let msg; try { msg=JSON.parse(raw); } catch { return; }
    if (msg.type==='start_game' && idx===0 && lobby.status==='ready') {
      lobby.status='playing';
      lobby.rematchVotes=[false,false];
      lobby.mapId = msg.mapId || 'arena';
      lobby.gameState=makeState(lobby.mapId);
      bcast(lobby,{type:'map_selected', mapId: lobby.mapId});
      bcast(lobby,{type:'game_start'});
      let last=Date.now();
      lobby.tickInterval=setInterval(()=>{
        const now=Date.now(), dt=(now-last)/1000; last=now;
        const result=tickGame(lobby.gameState,dt,now);
        const s=lobby.gameState;
        bcast(lobby,{type:'state',tick:s.tick,
          players:s.players.map(p=>({x:p.x,y:p.y,angle:p.angle,turretAngle:p.turretAngle,hp:p.hp,alive:p.alive})),
          bullets:s.bullets.map(b=>({id:b.id,ownerIndex:b.owner,x:b.x,y:b.y}))});
        if (result) { bcast(lobby,{type:'game_over',winner:result.winner}); destroyLobby(code); }
      }, TICK_MS);
    }
    if (msg.type==='rematch_request') {
      lobby.rematchVotes[idx] = true;
      const otherIdx = idx === 0 ? 1 : 0;
      wsend(lobby.sockets[otherIdx], {type:'rematch_request'});
      if (lobby.rematchVotes[0] && lobby.rematchVotes[1]) {
        lobby.rematchVotes = [false, false];
        if (lobby.tickInterval) { clearInterval(lobby.tickInterval); lobby.tickInterval = null; }
        lobby.status    = 'playing';
        const mapIds = Object.keys(MAP_DEFS);
        const others = mapIds.filter(id => id !== lobby.mapId);
        lobby.mapId  = others[Math.floor(Math.random() * others.length)] || 'arena';
        lobby.gameState = makeState(lobby.mapId);
        bcast(lobby, {type:'map_selected', mapId: lobby.mapId});
        bcast(lobby, {type:'rematch_start'});
        let last = Date.now();
        lobby.tickInterval = setInterval(() => {
          const now = Date.now(), dt = (now - last) / 1000; last = now;
          const result = tickGame(lobby.gameState, dt, now);
          const s = lobby.gameState;
          bcast(lobby, {type:'state', tick:s.tick,
            players: s.players.map(p=>({x:p.x,y:p.y,angle:p.angle,turretAngle:p.turretAngle,hp:p.hp,alive:p.alive})),
            bullets: s.bullets.map(b=>({id:b.id,ownerIndex:b.owner,x:b.x,y:b.y}))});
          if (result) { bcast(lobby, {type:'game_over', winner:result.winner}); destroyLobby(lobby.code); }
        }, TICK_MS);
      }
    }
    if (msg.type==='input' && lobby.gameState) {
      const pl=lobby.gameState.players[idx];
      if (pl) Object.assign(pl.input, msg.input);
    }
  });

  socket.on('close', () => {
    console.log(`[ws] Player ${idx} disconnected from lobby ${code}`);
    const l=getLobby(code); if (!l) return;
    wsend(l.sockets[idx===0?1:0], {type:'opponent_disconnected'});
    destroyLobby(code);
  });
});

setInterval(()=>{
  const cutoff=Date.now()-10*60*1000;
  for (const [code,l] of lobbies)
    if (l.createdAt<cutoff && l.status==='waiting') destroyLobby(code);
}, 60000);

server.listen(PORT, ()=>{
  console.log(`\nTank Commander → http://localhost:${PORT}`);
  console.log(`WebSocket      → ws://localhost:${PORT}/game\n`);
});