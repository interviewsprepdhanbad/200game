import { SUIT_SYMBOL, RED_SUITS } from '../config.js';
import { canAddToSelection } from '/shared/meld.js';

export function isJokerCard(card) {
  return card?.isJoker === true || card?.rank === 'Joker';
}

function suitSymbol(suit) {
  return SUIT_SYMBOL[suit] || '';
}

export function handPoints(hand) {
  if (!hand) return 0;
  return hand.reduce((sum, card) => {
    if (isJokerCard(card)) return sum;
    if (card.rank === 'A') return sum + 1;
    if (['J', 'Q', 'K'].includes(card.rank)) return sum + 10;
    return sum + parseInt(card.rank, 10);
  }, 0);
}

export function createCardElement(card, { selectable, selected, onSelect }) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.id = card.id;

  if (isJokerCard(card)) {
    div.classList.add('joker');
    div.innerHTML = '<span class="rank">JOKER</span><span class="suit">🃏</span>';
  } else {
    if (RED_SUITS.has(card.suit)) div.classList.add('red');
    div.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${suitSymbol(card.suit)}</span>`;
  }

  if (selectable && onSelect) {
    div.addEventListener('click', () => onSelect(card.id));
  }
  if (selected) div.classList.add('selected');
  return div;
}

export function createCardBackElement() {
  const div = document.createElement('div');
  div.className = 'card card-back-face';
  return div;
}

export function selectedCardsFromHand(hand, selectedIds) {
  return hand.filter((card) => selectedIds.has(card.id));
}

export function toggleCardSelection(state, cardId, hand) {
  if (!state.isMyTurn() || state.isAnimating) return;

  if (state.selectedCardIds.has(cardId)) {
    state.selectedCardIds.delete(cardId);
    return;
  }

  const selected = selectedCardsFromHand(hand, state.selectedCardIds);
  const card = hand.find((c) => c.id === cardId);
  if (!card) return;

  if (!canAddToSelection(selected, card)) {
    state.selectedCardIds.clear();
    state.selectedCardIds.add(cardId);
  } else {
    state.selectedCardIds.add(cardId);
  }
}
