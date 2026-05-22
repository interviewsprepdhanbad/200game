import { GAME_PHASE } from '../../shared/constants.js';
import { handTotal, canCallShow } from './engine.js';

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

/** Strip server-only fields; hide opponent hands except during showdown. */
export function toClientRoomState(room, viewerId) {
  const active = activePlayers(room);
  const isShowdown = room.phase === GAME_PHASE.ROUND_END || Boolean(room.showdown);

  return {
    code: room.code,
    phase: room.phase,
    roundNumber: room.roundNumber,
    turnCount: room.turnCount,
    yourPlayerId: viewerId,
    currentTurnPlayerId: currentPlayer(room)?.id ?? null,
    canShow: canCallShow(room.turnCount, active.length),
    deckCount: room.deck.length,
    discardTop: room.discardPile[room.discardPile.length - 1] ?? null,
    discardCount: room.discardPile.length,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      eliminated: p.eliminated,
      connected: p.connected,
      handCount: p.hand.length,
      hand: p.id === viewerId || isShowdown ? p.hand : null,
      handTotal: isShowdown ? handTotal(p.hand) : null,
      roundPoints: p.roundPoints,
    })),
    showdown: room.showdown,
    winner: room.winner ? { id: room.winner.id, name: room.winner.name } : null,
    lastAction: sanitizeLastAction(room.lastAction, viewerId),
    logs: room.logs ?? [],
    turnTimeLimit: room.turnTimeLimit,
    turnStartTime: room.turnStartTime,
  };
}
