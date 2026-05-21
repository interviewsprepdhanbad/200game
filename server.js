const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const roomManager = require('./lib/roomManager');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

function attachSocketToRoom(socket, roomCode, playerId) {
  socket.playerId = playerId;
  socket.roomCode = roomCode;
  socket.join(roomCode);
}

function emitRoomState(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  io.to(roomCode).fetchSockets().then((sockets) => {
    for (const socket of sockets) {
      if (!socket.playerId) continue;
      const state = roomManager.sanitizeRoomForClient(room, socket.playerId);
      socket.emit('roomState', state);
    }
  });
}

function requireRoom(socket, cb) {
  if (!socket.roomCode || !socket.playerId) {
    cb?.({ ok: false, error: 'Not in a room — enter your name and join again' });
    return null;
  }
  const room = roomManager.getRoom(socket.roomCode);
  if (!room) {
    cb?.({ ok: false, error: 'Room not found — refresh and rejoin' });
    return null;
  }
  return room;
}

io.on('connection', (socket) => {
  socket.playerId = null;
  socket.playerName = null;
  socket.roomCode = null;

  socket.on('createRoom', ({ playerName, playerId }, cb) => {
    if (!playerId) {
      cb?.({ ok: false, error: 'Missing player id — refresh the page' });
      return;
    }
    const name = playerName?.trim() || 'Player';
    socket.playerName = name;
    const room = roomManager.createRoom(playerId, name);
    attachSocketToRoom(socket, room.code, playerId);
    cb?.({ ok: true, roomCode: room.code, playerId, phase: room.phase });
    emitRoomState(room.code);
  });

  socket.on('joinRoom', ({ roomCode, playerName, playerId }, cb) => {
    if (!playerId) {
      cb?.({ ok: false, error: 'Missing player id — refresh the page' });
      return;
    }
    const name = playerName?.trim() || 'Player';
    socket.playerName = name;
    const result = roomManager.joinRoom(roomCode, playerId, name);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    attachSocketToRoom(socket, result.room.code, playerId);
    cb?.({ ok: true, roomCode: result.room.code, playerId, phase: result.room.phase });
    emitRoomState(result.room.code);
  });

  socket.on('startGame', (_, cb) => {
    if (!requireRoom(socket, cb)) return;
    const result = roomManager.startGame(socket.roomCode, socket.playerId);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    cb?.({ ok: true });
    emitRoomState(socket.roomCode);
  });

  socket.on('dropAndSwap', ({ cardIds, drawFrom }, cb) => {
    if (!requireRoom(socket, cb)) return;
    const result = roomManager.dropAndSwap(socket.roomCode, socket.playerId, cardIds, drawFrom);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    cb?.({ ok: true });
    emitRoomState(socket.roomCode);
  });

  socket.on('callShow', (_, cb) => {
    if (!requireRoom(socket, cb)) return;
    const result = roomManager.callShow(socket.roomCode, socket.playerId);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    cb?.({ ok: true });
    emitRoomState(socket.roomCode);
  });

  socket.on('nextRound', (_, cb) => {
    if (!requireRoom(socket, cb)) return;
    const result = roomManager.nextRound(socket.roomCode, socket.playerId);
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    cb?.({ ok: true });
    emitRoomState(socket.roomCode);
  });

  socket.on('disconnect', () => {
    if (socket.roomCode && socket.playerId) {
      const room = roomManager.disconnectPlayer(socket.roomCode, socket.playerId);
      if (room) {
        emitRoomState(socket.roomCode);
      } else {
        io.to(socket.roomCode).emit('roomClosed');
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Game 200 v1.1 — http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const { execSync } = require('child_process');
    try {
      const ip = execSync('ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1', { encoding: 'utf8' }).trim();
      if (ip) console.log(`LAN: http://${ip}:${PORT}`);
    } catch (_) {}
  }
});
