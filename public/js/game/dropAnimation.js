import { $ } from '../ui/dom.js';
import { createCardElement, createCardBackElement, selectedCardsFromHand } from '../ui/cards.js';
import { playDropAndDrawAnimation } from '../ui/animations.js';

export function flashDiscardPile() {
  const pile = $('#discard-pile');
  pile.classList.remove('pile-flash');
  void pile.offsetWidth;
  pile.classList.add('pile-flash');
  setTimeout(() => pile.classList.remove('pile-flash'), 400);
}

export function captureDropAnimationTargets(state, drawFrom) {
  const handEl = $('#player-hand');
  const hand = state.me?.hand || [];
  const droppedCards = selectedCardsFromHand(hand, state.selectedCardIds);
  const sourceRects = droppedCards
    .map((card) => handEl.querySelector(`.card[data-id="${card.id}"]`)?.getBoundingClientRect())
    .filter((rect) => rect && rect.width > 0);

  const discardSlot = $('#discard-top');
  const deckBack = $('#deck-pile .deck-back');
  const drawSourceEl =
    drawFrom === 'discard'
      ? discardSlot.querySelector('.card') || discardSlot
      : deckBack;

  const handRect = handEl.getBoundingClientRect();
  const cardWidth =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 50;

  return {
    drawFrom,
    droppedCards,
    sourceRects,
    discardRect: discardSlot.getBoundingClientRect(),
    drawSourceRect: drawSourceEl.getBoundingClientRect(),
    handRect: {
      left: handRect.right - cardWidth - 8,
      top: handRect.top + handRect.height / 2 - handRect.height * 0.35,
      width: handRect.height * 0.5,
      height: handRect.height * 0.7,
    },
  };
}

export async function runDropAnimation(state, animMeta) {
  const lastAction = state.room?.lastAction;
  if (!lastAction || lastAction.type !== 'dropSwap') return;

  if (!animMeta) {
    const handEl = $('#player-hand');
    const handRect = handEl.getBoundingClientRect();
    animMeta = {
      droppedCards: [],
      sourceRects: [],
      discardRect: $('#discard-top').getBoundingClientRect(),
      drawFrom: lastAction.drawFrom,
      drawSourceRect:
        lastAction.drawFrom === 'deck'
          ? $('#deck-pile .deck-back').getBoundingClientRect()
          : $('#discard-top').getBoundingClientRect(),
      handRect: {
        left: handRect.right - 58,
        top: handRect.top + handRect.height / 2 - 40,
        width: 50,
        height: 70,
      },
    };
  }

  const drawnForAnim = lastAction.drawnCard || { id: 'hidden-draw' };

  state.isAnimating = true;
  $('#screen-game').classList.add('is-animating');

  try {
    await playDropAndDrawAnimation({
      droppedCards: animMeta.droppedCards || [],
      sourceRects: animMeta.sourceRects || [],
      discardRect: animMeta.discardRect,
      drawFrom: lastAction.drawFrom,
      drawSourceRect: animMeta.drawSourceRect,
      handRect: animMeta.handRect,
      drawnCard: drawnForAnim,
      showDrawnFace: lastAction.showDrawnFace === true,
      renderCardFace: (card) => createCardElement(card, { selectable: false }),
      renderCardBack: createCardBackElement,
    });
  } catch {
    /* still render board after animation failure */
  }

  state.isAnimating = false;
  $('#screen-game').classList.remove('is-animating');
}
