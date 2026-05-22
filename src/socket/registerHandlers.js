import { PLAYER_NAME_MAX_LENGTH } from '../../shared/constants.js';
import {
  attachSocketToRoom,
  requireSocketRoom,
} from './roomBroadcast.js';

function normalizeName(playerName) {
  const name = playerName?.trim() || 'Player';
  return name.slice(0, PLAYER_NAME_MAX_LENGTH);
}

function joinAck(room, playerId) {
  return {
    ok: true,
    roomCode: room.code,
    playerId,
    phase: room.phase,
  };
}

export function registerSocketHandlers(io, roomService, emitRoomState) {
  io.on('connection', (socket) => {
    socket.on('createRoom', ({ playerName, playerId }, callback) => {
      if (!playerId) {
        callback?.({ ok: false, error: 'Missing player id — refresh the page' });
        return;
      }

      const name = normalizeName(playerName);
      const result = roomService.createRoom(playerId, name);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }

      const room = result.value;
      attachSocketToRoom(socket, room.code, playerId, name);
      callback?.(joinAck(room, playerId));
      emitRoomState(room.code);
    });

    socket.on('joinRoom', ({ roomCode, playerName, playerId }, callback) => {
      if (!playerId) {
        callback?.({ ok: false, error: 'Missing player id — refresh the page' });
        return;
      }

      const name = normalizeName(playerName);
      const result = roomService.joinRoom(roomCode, playerId, name);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }

      const room = result.value;
      attachSocketToRoom(socket, room.code, playerId, name);
      callback?.(joinAck(room, playerId));
      emitRoomState(room.code);
    });

    socket.on('leaveRoom', (_payload, callback) => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;

      const result = roomService.leaveRoom(roomCode, playerId);
      socket.leave(roomCode);
      socket.data.roomCode = null;
      
      callback?.({ ok: true });
      if (result.ok && result.value) {
        emitRoomState(roomCode);
      } else {
        io.to(roomCode).emit('roomClosed');
      }
    });

    socket.on('startGame', (_payload, callback) => {
      if (!requireSocketRoom(socket, roomService, callback)) return;

      const result = roomService.startGame(socket.data.roomCode, socket.data.playerId);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }
      callback?.({ ok: true });
      emitRoomState(socket.data.roomCode);
    });

    socket.on('dropAndSwap', ({ cardIds, drawFrom }, callback) => {
      if (!requireSocketRoom(socket, roomService, callback)) return;

      const result = roomService.dropAndSwap(
        socket.data.roomCode,
        socket.data.playerId,
        cardIds,
        drawFrom
      );
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }
      callback?.({ ok: true });
      emitRoomState(socket.data.roomCode);
    });

    socket.on('callShow', (_payload, callback) => {
      if (!requireSocketRoom(socket, roomService, callback)) return;

      const result = roomService.callShow(socket.data.roomCode, socket.data.playerId);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }
      callback?.({ ok: true });
      emitRoomState(socket.data.roomCode);
    });

    socket.on('nextRound', (_payload, callback) => {
      if (!requireSocketRoom(socket, roomService, callback)) return;

      const result = roomService.nextRound(socket.data.roomCode, socket.data.playerId);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }
      callback?.({ ok: true });
      emitRoomState(socket.data.roomCode);
    });

    socket.on('resetGame', (_payload, callback) => {
      if (!requireSocketRoom(socket, roomService, callback)) return;

      const result = roomService.resetGame(socket.data.roomCode, socket.data.playerId);
      if (!result.ok) {
        callback?.({ ok: false, error: result.error });
        return;
      }
      callback?.({ ok: true });
      emitRoomState(socket.data.roomCode);
    });

    socket.on('disconnect', () => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;

      const result = roomService.disconnectPlayer(roomCode, playerId);
      if (result.ok && result.value) {
        emitRoomState(roomCode);
      } else {
        io.to(roomCode).emit('roomClosed');
      }
    });
  });
}
