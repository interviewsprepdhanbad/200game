const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

function cardId(suit, rank) {
  return `${suit}-${rank}`;
}

function createDeck(playerCount) {
  const deckCount = playerCount >= 5 ? 2 : 1;
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardPoints(card) {
  if (card.isJoker) return 0;
  if (card.rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handTotal(hand) {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

function isSet(cards) {
  if (cards.length < 2) return false;
  const nonJokers = cards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return cards.length >= 2;
  const rank = nonJokers[0].rank;
  return nonJokers.every((c) => c.rank === rank);
}

function isRun(cards) {
  if (cards.length < 3) return false;
  const jokers = cards.filter((c) => c.isJoker);
  const nonJokers = cards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return false;
  const suit = nonJokers[0].suit;
  if (!nonJokers.every((c) => c.suit === suit)) return false;

  const values = nonJokers.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const unique = [...new Set(values)];
  if (unique.length !== values.length) return false;

  const span = unique[unique.length - 1] - unique[0] + 1;
  return span === cards.length && jokers.length + unique.length === cards.length;
}

function isValidDrop(cards) {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  if (isSet(cards)) return true;
  if (isRun(cards)) return true;
  return false;
}

/** True when drop matches discard rank (same face value / same face card) — no draw. */
function canDropWithoutDraw(dropCards, discardTop) {
  if (!discardTop || discardTop.isJoker || dropCards.length === 0) return false;
  if (!isValidDrop(dropCards)) return false;

  if (dropCards.length === 1) {
    const c = dropCards[0];
    if (c.isJoker) return false;
    return c.rank === discardTop.rank;
  }

  if (!isSet(dropCards)) return false;
  const nonJokers = dropCards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return false;
  return nonJokers.every((c) => c.rank === discardTop.rank);
}

function canCallShow(turnCount, playerCount) {
  return turnCount >= playerCount;
}

const CAUGHT_PENALTY = 50;

function resolveShow(allHands) {
  const caller = allHands.find((h) => h.isCaller);
  const callerTotal = handTotal(caller.hand);
  const lowestOpponent = Math.min(
    ...allHands.filter((h) => !h.isCaller).map((h) => handTotal(h.hand))
  );
  const caught = allHands.some(
    (h) => !h.isCaller && handTotal(h.hand) <= callerTotal
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

  const catcherIds = allHands
    .filter((h) => !h.isCaller && handTotal(h.hand) === lowestOpponent)
    .map((h) => h.playerId);

  return {
    caught: true,
    results: allHands.map((h) => {
      if (h.isCaller) {
        return { playerId: h.playerId, roundPoints: CAUGHT_PENALTY };
      }
      if (catcherIds.includes(h.playerId) && handTotal(h.hand) === lowestOpponent) {
        return { playerId: h.playerId, roundPoints: 0 };
      }
      return { playerId: h.playerId, roundPoints: handTotal(h.hand) };
    }),
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffle,
  cardPoints,
  handTotal,
  isSet,
  isRun,
  isValidDrop,
  canDropWithoutDraw,
  canCallShow,
  CAUGHT_PENALTY,
  resolveShow,
  generateRoomCode,
};
