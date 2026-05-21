import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../src/game/roomStore.js';
import { RoomService } from '../src/game/roomService.js';
import { GAME_PHASE } from '../shared/constants.js';

describe('RoomService', () => {
  const store = new RoomStore();
  const service = new RoomService(store);

  it('creates and joins a room in lobby phase', () => {
    const created = service.createRoom('host-1', 'Alice');
    assert.equal(created.ok, true);
    const code = created.value.code;

    const joined = service.joinRoom(code, 'guest-1', 'Bob');
    assert.equal(joined.ok, true);
    assert.equal(joined.value.players.length, 2);
  });

  it('reconnects an existing player during a game', () => {
    const created = service.createRoom('host-2', 'Host');
    const code = created.value.code;
    service.joinRoom(code, 'guest-2', 'Guest');
    service.joinRoom(code, 'guest-3', 'Pat');
    service.startGame(code, 'host-2');

    const disconnected = service.disconnectPlayer(code, 'guest-2');
    assert.equal(disconnected.ok, true);
    assert.equal(disconnected.value.players.find((p) => p.id === 'guest-2').connected, false);

    const rejoined = service.joinRoom(code, 'guest-2', 'Guest');
    assert.equal(rejoined.ok, true);
    assert.equal(rejoined.value.phase, GAME_PHASE.PLAYING);
    assert.equal(rejoined.value.players.find((p) => p.id === 'guest-2').connected, true);
  });

  it('deletes the room when everyone disconnects', () => {
    const created = service.createRoom('solo', 'Solo');
    const code = created.value.code;
    const result = service.disconnectPlayer(code, 'solo');
    assert.equal(result.ok, true);
    assert.equal(result.value, null);
    assert.equal(service.getRoom(code), null);
  });
});
