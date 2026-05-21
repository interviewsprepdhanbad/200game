import { RANK_ORDER } from './constants.js';

export function isSet(cards) {
  if (cards.length < 2) return false;
  const nonJokers = cards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return cards.length >= 2;
  const rank = nonJokers[0].rank;
  return nonJokers.every((c) => c.rank === rank);
}

export function isRun(cards) {
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

export function isValidDrop(cards) {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  return isSet(cards) || isRun(cards);
}

/** Drop matches discard rank — no draw required. */
export function canDropWithoutDraw(dropCards, discardTop) {
  if (!discardTop || discardTop.isJoker || dropCards.length === 0) return false;
  if (!isValidDrop(dropCards)) return false;

  if (dropCards.length === 1) {
    const card = dropCards[0];
    if (card.isJoker) return false;
    return card.rank === discardTop.rank;
  }

  if (!isSet(dropCards)) return false;
  const nonJokers = dropCards.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return false;
  return nonJokers.every((c) => c.rank === discardTop.rank);
}

/** True while the player is still building a valid partial selection. */
export function canAddToSelection(selectedCards, newCard) {
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
