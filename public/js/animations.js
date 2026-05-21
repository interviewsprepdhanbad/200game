/* Card flight animations for drop & draw */

function getFlyLayer() {
  let layer = document.getElementById('card-fly-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'card-fly-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

function centerOf(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function createFlyingCard(cardEl, rect) {
  cardEl.classList.add('flying-card');
  placeFlying(cardEl, rect);
  getFlyLayer().appendChild(cardEl);
  return { el: cardEl, rect };
}

function flyElement(el, fromRect, toRect, duration = 420) {
  const from = centerOf(fromRect);
  const to = centerOf(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const scale =
    fromRect.width > 0 ? Math.min(toRect.width / fromRect.width, 1.05) * 0.92 : 0.92;

  el.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${duration * 0.7}ms ease`;

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
        setTimeout(resolve, duration + 60);
      });
    });
  });
}

function fadeOut(el, ms = 200) {
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '0';
  return new Promise((r) => setTimeout(r, ms));
}

function placeFlying(el, rect) {
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

/**
 * @param {object} opts
 * @param {object[]} opts.droppedCards
 * @param {DOMRect[]} opts.sourceRects
 * @param {DOMRect} opts.discardRect
 * @param {'deck'|'discard'} opts.drawFrom
 * @param {DOMRect} opts.drawSourceRect
 * @param {DOMRect} opts.handRect
 * @param {object|null} opts.drawnCard
 * @param {boolean} opts.showDrawnFace
 * @param {function} opts.renderCardFace
 * @param {function} opts.renderCardBack
 */
async function playDropAndDrawAnimation(opts) {
  const layer = getFlyLayer();
  const {
    droppedCards = [],
    sourceRects = [],
    discardRect,
    drawFrom,
    drawSourceRect,
    handRect,
    drawnCard,
    showDrawnFace,
    renderCardFace,
    renderCardBack,
  } = opts;

  const flyers = droppedCards
    .map((card, i) => {
      const rect = sourceRects[i];
      if (!rect || rect.width <= 0) return null;
      return createFlyingCard(renderCardFace(card), rect);
    })
    .filter(Boolean);

  if (flyers.length && discardRect.width > 0) {
    await Promise.all(
      flyers.map(({ el, rect }, i) =>
        new Promise((r) => setTimeout(r, i * 60)).then(() =>
          flyElement(el, rect, discardRect, 360)
        )
      )
    );
    await Promise.all(flyers.map(({ el }) => fadeOut(el, 140)));
    flyers.forEach(({ el }) => el.remove());
  }

  if (drawnCard && drawSourceRect.width > 0 && handRect.width > 0) {
    const incoming = showDrawnFace
      ? renderCardFace(drawnCard)
      : renderCardBack();
    incoming.classList.add('flying-card');
    placeFlying(incoming, drawSourceRect);
    layer.appendChild(incoming);

    const startRect = incoming.getBoundingClientRect();
    await flyElement(incoming, startRect, handRect, 400);
    await fadeOut(incoming, 120);
    incoming.remove();
  }

}
