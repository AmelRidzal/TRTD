# Tank Arena

A browser-based multiplayer top-down tank shooter with RTD elements built with Phaser 3 and Node.js.

## Game Modes

- **Wave Clear** – Solo. Survive endless waves of enemy tanks across 4 difficulty levels.
- **Duel** – 1v1 match via a 4-letter lobby code. Physics run server-side.
- **FFA** – Free-for-all for up to 8 players. Includes a Roll The Dice mode with random powerups.

## Setup

```bash
npm install
node server.js
```

Then open `index.html` in your browser.

## Controls

| Action | Input |
|---|---|
| Move | W A S D |
| Aim | Mouse |
| Fire | Left click |
| Q | Roll the dice |

## Stack

- **Client** – Phaser 3 (CDN), vanilla JS, no bundler
- **Server** – Node.js + WebSockets
