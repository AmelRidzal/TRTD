# Tank Commander — Game Server

Only one dependency: `ws` (WebSocket library). No Express, no other packages.

## Setup & run

```bash
cd server
npm install      # installs only the 'ws' package
node server.js
```

Then open **http://localhost:3000** in two browser windows or machines.

## How to play 1v1

1. Player 1 → **1V1 DUEL → CREATE LOBBY** — a 4-letter code appears
2. Share the code with Player 2
3. Player 2 → **1V1 DUEL → JOIN LOBBY** → enter code → JOIN
4. Both land on the lobby screen
5. Player 1 (host) clicks **START GAME**

## Deploy to Railway (free)

1. https://railway.app → New Project → GitHub repo
2. Set Root Directory to `server/`
3. Railway detects Node.js and runs `npm start`
4. Copy your Railway URL — the `SERVER_HTTP`/`SERVER_WS` in `js/state.js`
   auto-switch when `hostname !== 'localhost'`

## File overview

| File | Purpose |
|---|---|
| `server.js` | Everything: HTTP static files, REST API, WebSocket, physics loop |
| `package.json` | Single dependency: `ws` |
