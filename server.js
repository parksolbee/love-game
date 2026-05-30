import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(__dirname));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ============ THE COMMON STORE ============
// rooms: code -> { clients: Set<ws>, state: lastKnownState }
// The server holds the latest state per room so late-joiners and
// rejoiners always sync to the current game, and it relays live
// updates between the two players.
const rooms = new Map();

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { clients: new Set(), state: null };
    rooms.set(code, room);
  }
  return room;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToOthers(room, sender, msg) {
  for (const client of room.clients) {
    if (client !== sender) send(client, msg);
  }
}

let nextPeerId = 1;

wss.on('connection', (ws) => {
  ws.peerId = `peer-${nextPeerId++}`;
  ws.roomCode = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === 'join') {
      const code = String(msg.room || '').toUpperCase();
      if (!code) return;
      ws.roomCode = code;
      const room = getRoom(code);

      // Tell the newcomer about peers already here, and the current state.
      for (const peer of room.clients) {
        send(ws, { type: 'peerJoin', peerId: peer.peerId });
      }
      if (room.state) {
        send(ws, { type: 'action', action: 'state', payload: room.state });
      }

      // Add them and notify existing peers.
      room.clients.add(ws);
      broadcastToOthers(room, ws, { type: 'peerJoin', peerId: ws.peerId });
      return;
    }

    if (msg.type === 'action') {
      const room = ws.roomCode && rooms.get(ws.roomCode);
      if (!room) return;
      // The server is the store: remember the latest game state.
      if (msg.action === 'state') {
        room.state = msg.payload;
      } else if (msg.action === 'reset') {
        if (room.state) { room.state.currentQ = 0; room.state.answers = {}; }
      }
      broadcastToOthers(room, ws, { type: 'action', action: msg.action, payload: msg.payload });
      return;
    }
  });

  ws.on('close', () => {
    const room = ws.roomCode && rooms.get(ws.roomCode);
    if (!room) return;
    room.clients.delete(ws);
    broadcastToOthers(room, ws, { type: 'peerLeave', peerId: ws.peerId });
    // Keep the room state around for rejoins; drop only when fully empty
    // and nothing is stored.
    if (room.clients.size === 0 && !room.state) rooms.delete(ws.roomCode);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`love-game listening on :${PORT}`);
});
