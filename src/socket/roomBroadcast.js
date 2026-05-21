import { toClientRoomState } from '../game/clientView.js';

export function createRoomBroadcaster(io, roomService) {
  return function emitRoomState(roomCode) {
    const room = roomService.getRoom(roomCode);
    if (!room) return;

    io.to(roomCode)
      .fetchSockets()
      .then((sockets) => {
        for (const socket of sockets) {
          if (!socket.data.playerId) continue;
          const state = toClientRoomState(room, socket.data.playerId);
          socket.emit('roomState', state);
        }
      })
      .catch((err) => {
        console.error('[emitRoomState]', roomCode, err);
      });
  };
}

export function attachSocketToRoom(socket, roomCode, playerId, playerName) {
  socket.data.playerId = playerId;
  socket.data.playerName = playerName;
  socket.data.roomCode = roomCode;
  socket.join(roomCode);
}

export function clearSocketRoom(socket) {
  socket.data.playerId = null;
  socket.data.playerName = null;
  socket.data.roomCode = null;
}

export function requireSocketRoom(socket, roomService, callback) {
  const { roomCode, playerId } = socket.data;
  if (!roomCode || !playerId) {
    callback?.({ ok: false, error: 'Not in a room — enter your name and join again' });
    return null;
  }
  const room = roomService.getRoom(roomCode);
  if (!room) {
    callback?.({ ok: false, error: 'Room not found — refresh and rejoin' });
    return null;
  }
  return room;
}
