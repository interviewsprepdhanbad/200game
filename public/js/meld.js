/* Meld validation — mirrors lib/gameEngine.js for client-side selection */
const RANK_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

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

/** True while building a selection (1 card, growing set, or growing run). */
function canAddToSelection(selectedCards, newCard) {
  const trial = [...selectedCards, newCard];
  if (trial.length === 1) return true;
  if (isValidDrop(trial)) return true;
  if (isSet(trial)) return true;
  if (trial.length >= 2 && canFormRun(trial)) return true;
  return false;
}

function canFormRun(cards) {
  const jokers = cards.filter((c) => c.isJoker);
  const nonJokers = cards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return cards.length >= 2;
  const suit = nonJokers[0].suit;
  if (!nonJokers.every((c) => c.suit === suit)) return false;
  const values = nonJokers.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const unique = [...new Set(values)];
  if (unique.length !== values.length) return false;
  const span = unique[unique.length - 1] - unique[0] + 1;
  return span <= cards.length && jokers.length + unique.length >= cards.length;
}
