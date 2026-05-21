const {
  createDeck,
  handTotal,
  isValidDrop,
  canDropWithoutDraw,
  canCallShow,
  resolveShow,
  generateRoomCode,
} = require('./gameEngine');

const ELIMINATION_SCORE = 200;
const STARTING_HAND_SIZE = 5;

const rooms = {};

function getRoom(code) {
  return rooms[code?.toUpperCase()] || null;
}

function createRoom(hostId, hostName) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms[code]);

  const player = makePlayer(hostId, hostName, true);
  rooms[code] = {
    code,
    phase: 'lobby',
    players: [player],
    deck: [],
    discardPile: [],
    currentTurnPlayerId: null,
    turnCount: 0,
    roundNumber: 0,
    lastAction: null,
    showdown: null,
  };
  return rooms[code];
}

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

function joinRoom(code, playerId, playerName) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };

  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.connected = true;
    if (playerName?.trim()) existing.name = playerName.trim();
    return { room };
  }

  if (room.phase !== 'lobby') {
    return { error: 'Game in progress — use the same browser/device you joined with, or wait for a new game' };
  }
  if (room.players.length >= 8) return { error: 'Room is full' };
  if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: 'Name already taken in this room' };
  }

  room.players.push(makePlayer(playerId, playerName));
  return { room };
}

function disconnectPlayer(code, playerId) {
  const room = getRoom(code);
  if (!room) return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return room;

  player.connected = false;

  const connected = room.players.filter((p) => p.connected);
  if (connected.length === 0) {
    delete rooms[code];
    return null;
  }

  if (!room.players.some((p) => p.isHost && p.connected)) {
    const nextHost = room.players.find((p) => p.connected);
    if (nextHost) nextHost.isHost = true;
  }

  if (room.phase === 'playing') {
    const active = activePlayers(room);
    if (active.length < 2) {
      room.phase = 'finished';
      room.winner = active[0] || null;
    } else if (room.currentTurnPlayerId === playerId) {
      advanceTurn(room);
    }
  }

  return room;
}

function activePlayers(room) {
  return room.players.filter((p) => !p.eliminated && p.connected);
}

function startGame(code, hostId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (!room.players.find((p) => p.id === hostId)?.isHost) {
    return { error: 'Only the host can start the game' };
  }
  if (room.players.length < 2) return { error: 'Need at least 2 players' };

  room.phase = 'playing';
  room.roundNumber = 1;
  beginRound(room);
  return { room };
}

function beginRound(room) {
  const active = activePlayers(room);
  room.deck = createDeck(active.length);
  room.discardPile = [];
  room.turnCount = 0;
  room.showdown = null;
  room.lastAction = null;

  for (const p of room.players) {
    p.hand = [];
    p.roundPoints = null;
  }

  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    for (const p of active) {
      p.hand.push(room.deck.pop());
    }
  }

  const starter = room.deck.pop();
  room.discardPile.push(starter);
  room.currentTurnPlayerId = active[0]?.id || null;
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

function cardsInHand(room, playerId, cardIds) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  return cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean);
}

function dropAndSwap(code, playerId, dropIds, drawFrom) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'playing') {
    return { error: `Not in active play (phase: ${room.phase}). Host may need to start or advance the round.` };
  }

  const player = currentPlayer(room);
  if (!player || player.id !== playerId) return { error: 'Not your turn' };

  const acting = room.players.find((p) => p.id === playerId);
  if (!acting?.connected) return { error: 'You are disconnected — refresh and rejoin the room' };

  if (dropIds.length === 0) return { error: 'Select cards to drop' };
  const dropCards = cardsInHand(room, playerId, dropIds);
  if (dropCards.length !== dropIds.length) return { error: 'Invalid card selection' };
  if (!isValidDrop(dropCards)) return { error: 'Invalid drop configuration' };

  const discardTop = room.discardPile[room.discardPile.length - 1] || null;

  if (drawFrom === 'none') {
    if (!canDropWithoutDraw(dropCards, discardTop)) {
      return { error: 'Cards must match discard rank to drop without drawing' };
    }
    player.hand = player.hand.filter((c) => !dropIds.includes(c.id));
    room.discardPile.push(...dropCards);
    room.lastAction = {
      type: 'dropSwap',
      playerId,
      dropIds,
      drawFrom: 'none',
      drawnId: null,
      drawnCard: null,
    };
    advanceTurn(room);
    checkWinner(room);
    return { room };
  }

  player.hand = player.hand.filter((c) => !dropIds.includes(c.id));

  let drawn;
  if (drawFrom === 'discard') {
    if (room.discardPile.length === 0) {
      return { error: 'Cannot draw from discard' };
    }
    drawn = room.discardPile.pop();
  }

  room.discardPile.push(...dropCards);

  if (drawFrom === 'deck') {
    if (room.deck.length === 0) {
      reshuffleDiscard(room);
    }
    if (room.deck.length === 0) return { error: 'Deck is empty' };
    drawn = room.deck.pop();
  } else if (drawFrom === 'discard') {
    /* drawn already taken from pile before drops were added */
  } else {
    return { error: 'Invalid draw source' };
  }

  player.hand.push(drawn);
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
  return { room };
}

function reshuffleDiscard(room) {
  const top = room.discardPile.pop();
  const rest = room.discardPile.splice(0);
  room.deck = rest.sort(() => Math.random() - 0.5);
  if (top) room.discardPile.push(top);
}

function callShow(code, playerId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'playing') {
    return { error: `Not in active play (phase: ${room.phase}). Host may need to start or advance the round.` };
  }

  const player = currentPlayer(room);
  if (!player || player.id !== playerId) return { error: 'Not your turn' };

  const active = activePlayers(room);
  if (!canCallShow(room.turnCount, active.length)) {
    return { error: 'Show is locked until each player has had a turn' };
  }

  const hands = active.map((p) => ({
    playerId: p.id,
    hand: p.hand,
    isCaller: p.id === playerId,
  }));

  const { caught, results } = resolveShow(hands);

  for (const r of results) {
    const p = room.players.find((pl) => pl.id === r.playerId);
    if (p) {
      p.roundPoints = r.roundPoints;
      p.score += r.roundPoints;
      if (p.score >= ELIMINATION_SCORE) p.eliminated = true;
    }
  }

  room.phase = 'roundEnd';
  room.showdown = {
    callerId: playerId,
    caught,
    results,
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
  return { room };
}

function checkWinner(room) {
  const active = activePlayers(room);
  if (active.length <= 1) {
    room.phase = 'finished';
    room.winner = active[0] || null;
  }
}

function nextRound(code, hostId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (!room.players.find((p) => p.id === hostId)?.isHost) {
    return { error: 'Only the host can start the next round' };
  }
  if (room.phase !== 'roundEnd') return { error: 'Round not finished' };

  const active = activePlayers(room);
  if (active.length < 2) {
    room.phase = 'finished';
    room.winner = active[0] || null;
    return { room };
  }

  room.roundNumber += 1;
  room.phase = 'playing';
  beginRound(room);
  return { room };
}

function sanitizeLastAction(lastAction, viewerId) {
  if (!lastAction) return null;
  if (lastAction.type !== 'dropSwap') return lastAction;

  const isActor = lastAction.playerId === viewerId;
  return {
    type: lastAction.type,
    playerId: lastAction.playerId,
    dropIds: lastAction.dropIds,
    drawFrom: lastAction.drawFrom,
    drawnId: isActor ? lastAction.drawnId : null,
    drawnCard: isActor ? lastAction.drawnCard : null,
    showDrawnFace: isActor,
  };
}

function sanitizeRoomForClient(room, viewerId) {
  const active = activePlayers(room);
  const isShowdown = room.phase === 'roundEnd' || room.showdown;

  return {
    code: room.code,
    phase: room.phase,
    roundNumber: room.roundNumber,
    turnCount: room.turnCount,
    yourPlayerId: viewerId,
    currentTurnPlayerId: currentPlayer(room)?.id || null,
    canShow: canCallShow(room.turnCount, active.length),
    deckCount: room.deck.length,
    discardTop: room.discardPile[room.discardPile.length - 1] || null,
    discardCount: room.discardPile.length,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      eliminated: p.eliminated,
      connected: p.connected,
      handCount: p.hand.length,
      hand:
        p.id === viewerId || isShowdown
          ? p.hand
          : null,
      handTotal: isShowdown ? handTotal(p.hand) : null,
      roundPoints: p.roundPoints,
    })),
    showdown: room.showdown,
    winner: room.winner ? { id: room.winner.id, name: room.winner.name } : null,
    lastAction: sanitizeLastAction(room.lastAction, viewerId),
  };
}

module.exports = {
  rooms,
  getRoom,
  createRoom,
  joinRoom,
  disconnectPlayer,
  startGame,
  dropAndSwap,
  callShow,
  nextRound,
  sanitizeRoomForClient,
};
