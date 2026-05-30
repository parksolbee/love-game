# i love you, but who are you?

A two-player date-night game. One person creates a room, shares the 4-letter
code, and you both answer questions about each other live.

## How sync works

Originally this was peer-to-peer (Trystero over BitTorrent trackers), which
couldn't reliably connect two browsers. It now uses a tiny Node server as a
**common store**: it serves the page and relays/holds each room's state over a
WebSocket, so late-joiners and rejoiners always sync to the current game.

- `index.html` — the whole client (UI + game logic + WebSocket sync)
- `server.js` — Express static server + WebSocket relay/store on `/ws`

## Run locally

```bash
npm install
npm start          # serves on http://localhost:3000
```

Open the URL in two browser windows to play both sides.

## Deploy (Railway)

```bash
railway login
railway link       # select the "love-game" project
railway up         # build & deploy
railway domain     # generate a public URL
```

The server listens on `process.env.PORT` (Railway sets this automatically).
