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
const MAP_W=900, MAP_H=600, PLAYER_SPEED=170, BULLET_SPEED=530;
const FIRE_CD=270, BULLET_DMG=34, BULLET_R=5, TANK_R=16;

// Wall rects for server-side collision { x,y,w,h } top-left origin
const TILE = 40;
function buildWalls() {
  const w = [];
  // Border
  for (let x=0;x<MAP_W;x+=TILE) { w.push({x,y:0,w:TILE,h:TILE}); w.push({x,y:MAP_H-TILE,w:TILE,h:TILE}); }
  for (let y=TILE;y<MAP_H-TILE;y+=TILE) { w.push({x:0,y,w:TILE,h:TILE}); w.push({x:MAP_W-TILE,y,w:TILE,h:TILE}); }
  // Interior (centre coords → top-left)
  const pts=[[200,160],[200,200],[200,240],[200,360],[200,400],[200,440],
             [700,160],[700,200],[700,240],[700,360],[700,400],[700,440],
             [360,240],[400,240],[440,240],[360,360],[400,360],[440,360],
             [360,300],[440,300],[120,280],[120,320],[780,280],[780,320],
             [280,120],[320,120],[560,120],[600,120],[280,480],[320,480],[560,480],[600,480]];
  for (const [cx,cy] of pts) w.push({x:cx-TILE/2, y:cy-TILE/2, w:TILE, h:TILE});
  return w;
}
const WALLS = buildWalls();

function circleWall(cx,cy,cr) {
  for (const w of WALLS) {
    const nx=Math.max(w.x,Math.min(cx,w.x+w.w)), ny=Math.max(w.y,Math.min(cy,w.y+w.h));
    if ((cx-nx)**2+(cy-ny)**2 < cr*cr) return true;
  }
  return false;
}

function makeState() {
  return {
    tick:0, status:'playing', winner:null, nextBulletId:0, bullets:[],
    players:[
      {x:180,y:300,angle:90,turretAngle:90,hp:100,alive:true,lastFire:0,
       input:{up:false,down:false,left:false,right:false,fire:false,turretAngle:90}},
      {x:720,y:300,angle:-90,turretAngle:-90,hp:100,alive:true,lastFire:0,
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
      if (!circleWall(nx,p.y,TANK_R)) p.x=nx;
      if (!circleWall(p.x,ny,TANK_R)) p.y=ny;
      p.x=Math.max(TANK_R,Math.min(MAP_W-TANK_R,p.x));
      p.y=Math.max(TANK_R,Math.min(MAP_H-TANK_R,p.y));
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
    if (b.x<0||b.x>MAP_W||b.y<0||b.y>MAP_H) continue;
    if (circleWall(b.x,b.y,BULLET_R)) continue;
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
    lobbies.set(code, {code, status:'waiting', sockets:[null,null], gameState:null, tickInterval:null, createdAt:Date.now()});
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
      lobby.gameState=makeState();
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
