// ================================================================
//  server.js  —  Tank Commander game server
//  Zero external dependencies — uses only Node.js built-ins.
//
//  Run:  node server/server.js
//  Then open:  http://localhost:3000
// ================================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws'); // only dep

// ── Paths ─────────────────────────────────────────────────────────
const SERVER_DIR = fs.realpathSync(path.dirname(process.argv[1]));
const GAME_DIR   = path.resolve(SERVER_DIR, '..');
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
  // Only serve GET requests
  if (req.method !== 'GET') return false;

  let urlPath = req.url.split('?')[0]; // strip query string
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Prevent directory traversal
  const filePath = path.resolve(GAME_DIR, '.' + urlPath);
  if (!filePath.startsWith(GAME_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false; // let caller handle 404
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(data);
  return true;
}

// ── Lobby manager (inline, no separate file needed for HTTP) ──────
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

// ── Map definitions (must match js/maps/*.js) ──────────────────────
function borderPts(w,h) {
  const p=[];
  for(let x=0;x<w;x+=TILE){p.push([x+20,20]);p.push([x+20,h-20]);}
  for(let y=TILE;y<h-TILE;y+=TILE){p.push([20,y+20]);p.push([w-20,y+20]);}
  return p;
}
function ptsToWalls(pts,w,h) {
  // pts are [cx,cy] tile centres; convert to AABB {x,y,w,h} top-left
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
      state.bullets.push({id:state.nextBulletId++,owner:i,
        x:p.x+Math.cos(rad)*24, y:p.y+Math.sin(rad)*24,
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

// ── HTTP server ───────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API routes
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

  // Static files
  if (!serveStatic(req, res)) {
    res.writeHead(404); res.end('Not found: ' + req.url);
  }
});

// ── WebSocket ─────────────────────────────────────────────────────
const wss = new WebSocketServer({server, path:'/game'});

wss.on('connection', (socket, req) => {
  const p     = new URLSearchParams(req.url.replace('/game?',''));
  const code  = (p.get('code')||'').toUpperCase();
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
      // Tell the OTHER player that this player wants a rematch
      const otherIdx = idx === 0 ? 1 : 0;
      wsend(lobby.sockets[otherIdx], {type:'rematch_request'});
      // If both have voted, restart
      if (lobby.rematchVotes[0] && lobby.rematchVotes[1]) {
        lobby.rematchVotes = [false, false];
        // Stop old game loop
        if (lobby.tickInterval) { clearInterval(lobby.tickInterval); lobby.tickInterval = null; }
        // Fresh game state, keep same lobby/sockets
        lobby.status    = 'playing';
        // Pick a new random map for the rematch
        const mapIds = Object.keys(MAP_DEFS);
        const others = mapIds.filter(id => id !== lobby.mapId);
        lobby.mapId  = others[Math.floor(Math.random() * others.length)] || 'arena';
        lobby.gameState = makeState(lobby.mapId);
        bcast(lobby, {type:'map_selected', mapId: lobby.mapId});
        bcast(lobby, {type:'rematch_start'});
        // Start a new game loop
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

// Stale lobby cleanup
setInterval(()=>{
  const cutoff=Date.now()-10*60*1000;
  for (const [code,l] of lobbies)
    if (l.createdAt<cutoff && l.status==='waiting') destroyLobby(code);
}, 60000);

server.listen(PORT, ()=>{
  console.log(`\nTank Commander → http://localhost:${PORT}`);
  console.log(`WebSocket      → ws://localhost:${PORT}/game\n`);
});
