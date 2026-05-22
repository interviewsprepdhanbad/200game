import { SUITS, RANKS, CAUGHT_PENALTY } from '../../shared/constants.js';
import { isValidDrop, canDropWithoutDraw } from '../../shared/meld.js';

export { isValidDrop, canDropWithoutDraw };

function cardId(suit, rank) {
  return `${suit}-${rank}`;
}

/** One deck per four players, plus one per five players (5→2 decks, 10→3, …). */
export function deckCountForPlayers(playerCount) {
  if (playerCount < 1) return 1;
  return Math.floor(playerCount / 5) + 1;
}

export function createDeck(playerCount) {
  const deckCount = deckCountForPlayers(playerCount);
  const deck = [];

  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `${cardId(suit, rank)}-${d}`, suit, rank, isJoker: false });
      }
    }
    deck.push({ id: `joker-${d}-1`, suit: null, rank: 'Joker', isJoker: true });
    deck.push({ id: `joker-${d}-2`, suit: null, rank: 'Joker', isJoker: true });
  }

  return shuffle(deck);
}

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** When the draw pile is empty, shuffle discard (except top card) back into the deck. */
export function replenishDeckFromDiscard(deck, discardPile) {
  if (discardPile.length < 2) return false;
  const top = discardPile.pop();
  const rest = discardPile.splice(0);
  deck.push(...shuffle(rest));
  if (top) discardPile.push(top);
  return deck.length > 0;
}

export function cardPoints(card) {
  if (card.isJoker) return 0;
  if (card.rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

export function handTotal(hand) {
  return hand.reduce((sum, card) => sum + cardPoints(card), 0);
}

export function canCallShow(turnCount, playerCount) {
  return turnCount >= playerCount;
}

export function resolveShow(allHands) {
  const caller = allHands.find((h) => h.isCaller);
  const callerTotal = handTotal(caller.hand);
  const lowestOpponent = Math.min(
    ...allHands.filter((h) => !h.isCaller).map((h) => handTotal(h.hand))
  );
  // Caught only if someone has STRICTLY less than the caller
  const caught = allHands.some(
    (h) => !h.isCaller && handTotal(h.hand) < callerTotal
  );

  if (!caught) {
    return {
      caught: false,
      results: allHands.map((h) => ({
        playerId: h.playerId,
        roundPoints: h.isCaller ? 0 : handTotal(h.hand),
      })),
    };
  }

  const lowestPlayerIds = allHands
    .filter((h) => !h.isCaller && handTotal(h.hand) === lowestOpponent)
    .map((h) => h.playerId);

  return {
    caught: true,
    lowestTotal: lowestOpponent,
    lowestPlayerIds,
    results: allHands.map((h) => {
      if (h.isCaller) {
        return { playerId: h.playerId, roundPoints: CAUGHT_PENALTY };
      }
      if (lowestPlayerIds.includes(h.playerId) && handTotal(h.hand) === lowestOpponent) {
        return { playerId: h.playerId, roundPoints: 0 };
      }
      return { playerId: h.playerId, roundPoints: handTotal(h.hand) };
    }),
  };
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
