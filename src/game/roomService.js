import {
  ELIMINATION_SCORE,
  STARTING_HAND_SIZE,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  GAME_PHASE,
  DRAW_SOURCE,
} from '../../shared/constants.js';
import { success, failure } from '../../shared/result.js';
import { isValidDrop, canDropWithoutDraw } from '../../shared/meld.js';
import {
  createDeck,
  handTotal,
  canCallShow,
  resolveShow,
  replenishDeckFromDiscard,
  generateRoomCode,
} from './engine.js';

function makePlayer(id, name, isHost = false) {
  return {
    id,
    name,
    isHost,
    hand: [],
    score: 0,
    eliminated: false,
    connected: true,
    roundPoints: null,
  };
}

function activePlayers(room) {
  return room.players.filter((p) => !p.eliminated && p.connected);
}

function currentPlayer(room) {
  const active = activePlayers(room);
  if (!active.length) return null;
  let idx = active.findIndex((p) => p.id === room.currentTurnPlayerId);
  if (idx < 0) idx = 0;
  return active[idx];
}

function advanceTurn(room) {
  const active = activePlayers(room);
  if (!active.length) return;
  let idx = active.findIndex((p) => p.id === room.currentTurnPlayerId);
  if (idx < 0) idx = 0;
  room.currentTurnPlayerId = active[(idx + 1) % active.length].id;
  room.turnCount += 1;
}

function beginRound(room) {
  const active = activePlayers(room);
  room.deck = createDeck(active.length);
  room.discardPile = [];
  room.turnCount = 0;
  room.showdown = null;
  room.lastAction = null;

  for (const player of room.players) {
    player.hand = [];
    player.roundPoints = null;
  }

  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    for (const player of active) {
      player.hand.push(room.deck.pop());
    }
  }

  const starter = room.deck.pop();
  room.discardPile.push(starter);
  room.currentTurnPlayerId = active[0]?.id ?? null;
}

function checkWinner(room) {
  const active = activePlayers(room);
  if (active.length <= 1) {
    room.phase = GAME_PHASE.FINISHED;
    room.winner = active[0] ?? null;
  }
}

function cardsInHand(room, playerId, cardIds) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return [];
  return cardIds
    .map((id) => player.hand.find((c) => c.id === id))
    .filter(Boolean);
}

function requireHost(room, hostId) {
  if (!room.players.find((p) => p.id === hostId)?.isHost) {
    return failure('Only the host can perform this action');
  }
  return null;
}

export class RoomService {
  constructor(store) {
    this.store = store;
  }

  getRoom(code) {
    return this.store.get(code);
  }

  createRoom(hostId, hostName) {
    const code = this.store.findAvailableCode(generateRoomCode, (c) => this.store.has(c));
    const room = {
      code,
      phase: GAME_PHASE.LOBBY,
      players: [makePlayer(hostId, hostName.trim() || 'Player', true)],
      deck: [],
      discardPile: [],
      currentTurnPlayerId: null,
      turnCount: 0,
      roundNumber: 0,
      lastAction: null,
      showdown: null,
      winner: null,
      logs: [],
    };
    this.store.set(room);
    return success(room);
  }

  joinRoom(code, playerId, playerName) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    const name = playerName?.trim() || 'Player';
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = true;
      if (name) existing.name = name;
      return success(room);
    }

    if (room.phase !== GAME_PHASE.LOBBY) {
      return failure(
        'Game in progress — use the same browser/device you joined with, or wait for a new game'
      );
    }
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      return failure('Room is full');
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return failure('Name already taken in this room');
    }

    room.players.push(makePlayer(playerId, name));
    return success(room);
  }

  disconnectPlayer(code, playerId) {
    const room = this.getRoom(code);
    if (!room) return success(null);

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return success(room);

    player.connected = false;

    const connected = room.players.filter((p) => p.connected);
    if (connected.length === 0) {
      this.store.delete(code);
      return success(null);
    }

    if (!room.players.some((p) => p.isHost && p.connected)) {
      const nextHost = room.players.find((p) => p.connected);
      if (nextHost) nextHost.isHost = true;
    }

    if (room.phase === GAME_PHASE.PLAYING) {
      const active = activePlayers(room);
      if (active.length < 2) {
        room.phase = GAME_PHASE.FINISHED;
        room.winner = active[0] ?? null;
      } else if (room.currentTurnPlayerId === playerId) {
        advanceTurn(room);
      }
    }

    return success(room);
  }

  startGame(code, hostId) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    const hostCheck = requireHost(room, hostId);
    if (hostCheck) return hostCheck;

    if (room.players.length < MIN_PLAYERS_TO_START) {
      return failure('Need at least 2 players');
    }

    room.phase = GAME_PHASE.PLAYING;
    room.roundNumber = 1;
    beginRound(room);
    return success(room);
  }

  dropAndSwap(code, playerId, dropIds, drawFrom) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    if (room.phase !== GAME_PHASE.PLAYING) {
      return failure(
        `Not in active play (phase: ${room.phase}). Host may need to start or advance the round.`
      );
    }

    const player = currentPlayer(room);
    if (!player || player.id !== playerId) return failure('Not your turn');

    const acting = room.players.find((p) => p.id === playerId);
    if (!acting?.connected) {
      return failure('You are disconnected — refresh and rejoin the room');
    }

    if (!Array.isArray(dropIds) || dropIds.length === 0) {
      return failure('Select cards to drop');
    }

    const dropCards = cardsInHand(room, playerId, dropIds);
    if (dropCards.length !== dropIds.length) return failure('Invalid card selection');
    if (!isValidDrop(dropCards)) return failure('Invalid drop configuration');

    const discardTop = room.discardPile[room.discardPile.length - 1] ?? null;

    if (drawFrom === DRAW_SOURCE.NONE) {
      if (!canDropWithoutDraw(dropCards, discardTop)) {
        return failure('Cards must match discard rank to drop without drawing');
      }
      player.hand = player.hand.filter((c) => !dropIds.includes(c.id));
      room.discardPile.push(...dropCards);
      
      const logMsg = `${player.name} dropped ${dropCards.map(c => c.isJoker ? 'Joker' : c.rank).join(', ')} (no draw)`;
      room.logs.push(logMsg);
      if (room.logs.length > 10) room.logs.shift();

      room.lastAction = {
        type: 'dropSwap',
        playerId,
        dropIds,
        drawFrom: DRAW_SOURCE.NONE,
        drawnId: null,
        drawnCard: null,
      };
      advanceTurn(room);
      checkWinner(room);
      return success(room);
    }

    player.hand = player.hand.filter((c) => !dropIds.includes(c.id));

    let drawn;
    if (drawFrom === DRAW_SOURCE.DISCARD) {
      if (room.discardPile.length === 0) return failure('Cannot draw from discard');
      drawn = room.discardPile.pop();
    }

    room.discardPile.push(...dropCards);

    if (drawFrom === DRAW_SOURCE.DECK) {
      if (room.deck.length === 0) {
        replenishDeckFromDiscard(room.deck, room.discardPile);
      }
      if (room.deck.length === 0) {
        return failure('Deck is empty — not enough cards in discard to reshuffle');
      }
      drawn = room.deck.pop();
      // Auto-replenish if empty after draw so next player sees cards
      if (room.deck.length === 0) {
        replenishDeckFromDiscard(room.deck, room.discardPile);
      }
    } else if (drawFrom === DRAW_SOURCE.DISCARD) {
      // drawn already taken before drops were added to the pile
    } else {
      return failure('Invalid draw source');
    }

    player.hand.push(drawn);

    const logMsg = `${player.name} dropped ${dropCards.map(c => c.isJoker ? 'Joker' : c.rank).join(', ')} & drew from ${drawFrom}`;
    room.logs.push(logMsg);
    if (room.logs.length > 10) room.logs.shift();

    room.lastAction = {
      type: 'dropSwap',
      playerId,
      dropIds,
      drawFrom,
      drawnId: drawn.id,
      drawnCard: { ...drawn },
    };

    advanceTurn(room);
    checkWinner(room);
    return success(room);
  }

  callShow(code, playerId) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    if (room.phase !== GAME_PHASE.PLAYING) {
      return failure(
        `Not in active play (phase: ${room.phase}). Host may need to start or advance the round.`
      );
    }

    const player = currentPlayer(room);
    if (!player || player.id !== playerId) return failure('Not your turn');

    const active = activePlayers(room);
    if (!canCallShow(room.turnCount, active.length)) {
      return failure('Show is locked until each player has had a turn');
    }

    const hands = active.map((p) => ({
      playerId: p.id,
      hand: p.hand,
      isCaller: p.id === playerId,
    }));

    const { caught, results, lowestTotal, lowestPlayerIds } = resolveShow(hands);

    for (const result of results) {
      const p = room.players.find((pl) => pl.id === result.playerId);
      if (p) {
        p.roundPoints = result.roundPoints;
        p.score += result.roundPoints;
        if (p.score >= ELIMINATION_SCORE) p.eliminated = true;
      }
    }

    const callerPoints = hands.find(h => h.isCaller)?.hand ? handTotal(hands.find(h => h.isCaller).hand) : 0;
    const logMsg = `${player.name} called SHOW (${callerPoints} pts) — ${caught ? 'CAUGHT!' : 'SUCCESS!'}`;
    room.logs.push(logMsg);
    if (room.logs.length > 10) room.logs.shift();

    room.phase = GAME_PHASE.ROUND_END;
    room.showdown = {
      callerId: playerId,
      callerPoints,
      caught,
      results,
      lowestCatchers: caught
        ? (lowestPlayerIds ?? []).map((id) => {
            const p = room.players.find((pl) => pl.id === id);
            return { playerId: id, name: p?.name ?? 'Player', total: lowestTotal };
          })
        : [],
      hands: active.map((p) => {
        const r = results.find((x) => x.playerId === p.id);
        return {
          playerId: p.id,
          hand: p.hand,
          total: handTotal(p.hand),
          roundPoints: r?.roundPoints ?? 0,
        };
      }),
    };

    checkWinner(room);
    return success(room);
  }

  nextRound(code, hostId) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    const hostCheck = requireHost(room, hostId);
    if (hostCheck) return hostCheck;

    if (room.phase !== GAME_PHASE.ROUND_END) {
      return failure('Round not finished');
    }

    const active = activePlayers(room);
    if (active.length < MIN_PLAYERS_TO_START) {
      room.phase = GAME_PHASE.FINISHED;
      room.winner = active[0] ?? null;
      return success(room);
    }

    room.roundNumber += 1;
    room.phase = GAME_PHASE.PLAYING;
    beginRound(room);
    return success(room);
  }

  resetGame(code, hostId) {
    const room = this.getRoom(code);
    if (!room) return failure('Room not found');

    const hostCheck = requireHost(room, hostId);
    if (hostCheck) return hostCheck;

    if (room.phase !== GAME_PHASE.FINISHED) {
      return failure('Game is not finished');
    }

    room.phase = GAME_PHASE.LOBBY;
    room.roundNumber = 0;
    room.winner = null;
    room.showdown = null;
    room.lastAction = null;
    room.turnCount = 0;
    room.logs = ['Game reset by host'];

    for (const player of room.players) {
      player.score = 0;
      player.eliminated = false;
      player.hand = [];
      player.roundPoints = null;
    }

    return success(room);
  }
}
