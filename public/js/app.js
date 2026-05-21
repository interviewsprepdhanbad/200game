/* global io, isValidDrop, canAddToSelection, canDropWithoutDraw, playDropAndDrawAnimation */

const SUIT_SYMBOL = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);
const PLAYER_ID_KEY = 'game200_playerId';
const SESSION_KEY = 'game200_session';

let socket = null;
let roomState = null;
let selectedCardIds = new Set();
let myPlayerId = null;
let pendingDropAnim = null;
let isAnimating = false;
let socketInRoom = false;
let restoringSession = false;

const $ = (sel) => document.querySelector(sel);

const screens = {
  auth: $('#screen-auth'),
  lobby: $('#screen-lobby'),
  game: $('#screen-game'),
};

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'p-' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

function saveSession(roomCode, playerName, phase) {
  if (!roomCode || !playerName) return;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      roomCode: String(roomCode).toUpperCase(),
      playerName,
      phase: phase || null,
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

function loadSession() {
  try {
    let raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(SESSION_KEY);
      if (legacy) {
        localStorage.setItem(SESSION_KEY, legacy);
        sessionStorage.removeItem(SESSION_KEY);
        raw = legacy;
      }
    }
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

function showReconnecting(detail) {
  const el = $('#overlay-reconnecting');
  if (detail) $('#reconnecting-detail').textContent = detail;
  el.classList.remove('hidden');
}

function hideReconnecting() {
  $('#overlay-reconnecting').classList.add('hidden');
}

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove('active'));
  screens[name]?.classList.add('active');
}

function showError(msg) {
  const el = $('#auth-error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function showToast(msg) {
  const el = $('#game-message');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function suitSymbol(suit) {
  return SUIT_SYMBOL[suit] || '';
}

function isJokerCard(card) {
  return card?.isJoker === true || card?.rank === 'Joker';
}

function selectedCardsFromHand(hand) {
  return hand.filter((c) => selectedCardIds.has(c.id));
}

function renderCard(card, selectable, hand) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.id = card.id;
  if (isJokerCard(card)) {
    div.classList.add('joker');
    div.textContent = '🃏';
  } else {
    if (RED_SUITS.has(card.suit)) div.classList.add('red');
    div.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${suitSymbol(card.suit)}</span>`;
  }
  if (selectable) {
    div.addEventListener('click', () => toggleCard(card.id, hand));
  }
  if (selectedCardIds.has(card.id)) div.classList.add('selected');
  return div;
}

function renderCardBackEl() {
  const div = document.createElement('div');
  div.className = 'card card-back-face';
  return div;
}

function toggleCard(id, hand) {
  if (!isMyTurn() || isAnimating) return;
  if (selectedCardIds.has(id)) {
    selectedCardIds.delete(id);
  } else {
    const selected = selectedCardsFromHand(hand);
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    if (!canAddToSelection(selected, card)) {
      selectedCardIds.clear();
      selectedCardIds.add(id);
    } else {
      selectedCardIds.add(id);
    }
  }
  renderGame();
}

function handPoints(hand) {
  if (!hand) return 0;
  return hand.reduce((s, c) => {
    if (isJokerCard(c)) return s;
    if (c.rank === 'A') return s + 1;
    if (['J', 'Q', 'K'].includes(c.rank)) return s + 10;
    return s + parseInt(c.rank, 10);
  }, 0);
}

function me() {
  return roomState?.players?.find((p) => p.id === myPlayerId);
}

function isMyTurn() {
  return roomState?.phase === 'playing' && roomState?.currentTurnPlayerId === myPlayerId;
}

function selectionIsValid(hand) {
  const cards = selectedCardsFromHand(hand);
  return cards.length > 0 && isValidDrop(cards);
}

function selectionMatchesDiscard(hand) {
  const cards = selectedCardsFromHand(hand);
  return canDropWithoutDraw(cards, roomState?.discardTop);
}

function renderAuth() {
  showScreen('auth');
}

function formatLowestCatchers(catchers) {
  if (!catchers?.length) return 'lowest hand unknown';
  const total = catchers[0].total;
  if (catchers.length === 1) {
    return `${catchers[0].name} has ${total} points`;
  }
  const names = catchers.map((c) => c.name).join(' & ');
  return `${names} have ${total} points`;
}

function renderLobby() {
  showScreen('lobby');
  $('#lobby-room-code').textContent = roomState.code;
  $('#lobby-phase').textContent =
    roomState.phase === 'lobby'
      ? 'Lobby'
      : roomState.phase === 'roundEnd'
        ? `Round ${roomState.roundNumber} — Results`
        : roomState.phase === 'finished'
          ? 'Finished'
          : `Round ${roomState.roundNumber}`;

  const list = $('#player-list');
  list.innerHTML = '';
  for (const p of roomState.players) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    let label = p.name + (p.isHost ? ' ★' : '') + (p.id === myPlayerId ? ' (you)' : '');
    if (!p.connected) label += ' (away)';
    left.textContent = label;
    if (p.eliminated) left.classList.add('eliminated');
    const right = document.createElement('span');
    right.className = 'score';
    right.textContent = p.eliminated ? 'OUT' : `${p.score} pts`;
    if (p.roundPoints !== null && p.roundPoints !== undefined) {
      right.textContent += ` (+${p.roundPoints})`;
    }
    li.append(left, right);
    list.appendChild(li);
  }

  const host = me()?.isHost;
  const playing = roomState.phase === 'playing';
  const roundEnd = roomState.phase === 'roundEnd';
  const finished = roomState.phase === 'finished';

  $('#btn-start').classList.toggle('hidden', !host || playing || roundEnd || finished);
  $('#btn-next-round').classList.toggle('hidden', !host || !roundEnd);
  $('#lobby-hint').classList.toggle(
    'hidden',
    (host && roomState.phase === 'lobby') || roundEnd || finished
  );
  $('#lobby-hint').textContent =
    roomState.phase === 'lobby'
      ? 'Waiting for host to start…'
      : roomState.phase === 'roundEnd'
        ? 'Host: tap Next Round to continue'
        : '';

  const sd = $('#showdown-summary');
  if (roomState.showdown && roundEnd) {
    sd.classList.remove('hidden');
    const s = roomState.showdown;
    const caller = roomState.players.find((p) => p.id === s.callerId);
    let html = `<strong>Showdown</strong> — ${caller?.name || 'Player'} called Show<br>`;
    if (s.caught) html += `<span class="caught">Caught! Caller adds 50 pts only (hand not scored).</span><br>`;
    else html += `Successful Show — caller scores 0.<br>`;
    for (const h of s.hands) {
      const pl = roomState.players.find((p) => p.id === h.playerId);
      const rp = h.roundPoints ?? roomState.players.find((p) => p.id === h.playerId)?.roundPoints;
      if (s.caught && h.playerId === s.callerId) {
        html += `${pl?.name}: <strong>+${rp ?? 50}</strong> penalty (${formatLowestCatchers(s.lowestCatchers)})<br>`;
      } else {
        html += `${pl?.name}: ${h.total} pts → +${rp ?? '?'}<br>`;
      }
    }
    sd.innerHTML = html;
  } else {
    sd.classList.add('hidden');
  }

  if (finished && roomState.winner) {
    $('#gameover-title').textContent = 'Winner!';
    $('#gameover-body').textContent = `${roomState.winner.name} wins Game 200!`;
    $('#overlay-gameover').classList.remove('hidden');
  }
}

function renderGame() {
  if (roomState.phase === 'lobby' || roomState.phase === 'roundEnd' || roomState.phase === 'finished') {
    selectedCardIds.clear();
    renderLobby();
    return;
  }

  showScreen('game');

  const strip = $('#scores-strip');
  strip.innerHTML = '';
  for (const p of roomState.players) {
    const chip = document.createElement('span');
    chip.className = 'score-chip';
    if (p.id === myPlayerId) chip.classList.add('you');
    if (p.id === roomState.currentTurnPlayerId) chip.classList.add('turn');
    chip.textContent = `${p.name}: ${p.score}`;
    if (p.eliminated) chip.textContent += ' ✗';
    if (!p.connected) chip.textContent += ' ◌';
    strip.appendChild(chip);
  }

  const turnName = roomState.players.find((p) => p.id === roomState.currentTurnPlayerId)?.name;
  $('#turn-indicator').textContent = isMyTurn()
    ? 'Your turn — pick cards from YOUR HAND below'
    : `${turnName || '…'}'s turn`;
  $('#deck-info').textContent = `Round ${roomState.roundNumber}`;

  const discardEl = $('#discard-top');
  discardEl.innerHTML = '';
  discardEl.classList.remove('empty');
  if (roomState.discardTop) {
    discardEl.appendChild(renderCard(roomState.discardTop, false, []));
  } else {
    discardEl.classList.add('empty');
    discardEl.textContent = '—';
  }
  $('#deck-count').textContent = roomState.deckCount;

  const opp = $('#opponents');
  opp.innerHTML = '';
  for (const p of roomState.players) {
    if (p.id === myPlayerId || p.eliminated) continue;
    const div = document.createElement('div');
    div.className = 'opponent';
    if (p.id === roomState.currentTurnPlayerId) div.classList.add('turn');
    div.innerHTML = `<strong>${p.name}</strong> — ${p.score} pts`;
    const cards = document.createElement('div');
    cards.className = 'cards';
    cards.textContent = `${p.handCount ?? p.hand?.length ?? 0} cards`;
    div.appendChild(cards);
    opp.appendChild(div);
  }

  const myHand = me()?.hand || [];
  const handEl = $('#player-hand');
  handEl.innerHTML = '';
  const canSelect = isMyTurn();
  for (const c of myHand) {
    handEl.appendChild(renderCard(c, canSelect, myHand));
  }
  $('#hand-total').textContent = myHand.length ? `(${handPoints(myHand)} pts)` : '';

  const panel = $('#action-panel');
  const myTurn = isMyTurn();
  panel.classList.toggle('hidden', !myTurn);

  const btnShow = $('#btn-show');
  const btnDropOnly = $('#btn-drop-only');
  const btnDeck = $('#btn-draw-deck');
  const btnDiscard = $('#btn-draw-discard');

  if (!myTurn) selectedCardIds.clear();

  if (myTurn && !isAnimating) {
    const valid = selectionIsValid(myHand);
    const matchDiscard = valid && selectionMatchesDiscard(myHand);
    const selCount = selectedCardIds.size;
    $('#action-hint').textContent =
      selCount === 0
        ? 'Tap hand cards: 1 card or same rank (2+) — then draw'
        : matchDiscard
          ? 'Matches discard rank — drop without drawing'
          : valid
            ? 'Valid drop — choose deck or discard pile to draw 1 card'
            : 'Keep selecting: need same rank (set)';
    btnShow.classList.toggle('hidden', !roomState.canShow);
    btnDropOnly.classList.toggle('hidden', !matchDiscard);
    btnDeck.classList.toggle('hidden', matchDiscard);
    btnDiscard.classList.toggle('hidden', matchDiscard);
    btnDropOnly.disabled = !matchDiscard;
    btnDeck.textContent = 'Drop & Draw Deck';
    btnDiscard.textContent = 'Drop & Take Discard';
    btnDeck.disabled = !valid || matchDiscard || roomState.deckCount === 0;
    btnDiscard.disabled = !valid || matchDiscard || !roomState.discardTop;
  } else {
    btnDropOnly.classList.add('hidden');
    btnDeck.classList.add('hidden');
    btnDiscard.classList.add('hidden');
    btnShow.classList.add('hidden');
  }
}

function flashDiscardPile() {
  const pile = $('#discard-pile');
  pile.classList.remove('pile-flash');
  void pile.offsetWidth;
  pile.classList.add('pile-flash');
  setTimeout(() => pile.classList.remove('pile-flash'), 400);
}

function captureDropAnimationTargets(drawFrom) {
  const handEl = $('#player-hand');
  const hand = me()?.hand || [];
  const droppedCards = selectedCardsFromHand(hand);
  const sourceRects = droppedCards
    .map((c) => handEl.querySelector(`.card[data-id="${c.id}"]`)?.getBoundingClientRect())
    .filter((r) => r && r.width > 0);
  const discardSlot = $('#discard-top');
  const deckBack = $('#deck-pile .deck-back');

  let drawSourceEl;
  let takenDiscardCard = null;
  if (drawFrom === 'discard') {
    takenDiscardCard = roomState?.discardTop ? { ...roomState.discardTop } : null;
    drawSourceEl = discardSlot.querySelector('.card') || discardSlot;
  } else {
    drawSourceEl = deckBack;
  }

  const handRect = handEl.getBoundingClientRect();
  const handTarget = {
    left: handRect.right - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 50) - 8,
    top: handRect.top + handRect.height / 2 - (handRect.height * 0.35),
    width: handRect.height * 0.5,
    height: handRect.height * 0.7,
  };

  return {
    drawFrom,
    droppedCards,
    sourceRects,
    takenDiscardCard,
    discardRect: discardSlot.getBoundingClientRect(),
    drawSourceRect: drawSourceEl.getBoundingClientRect(),
    handRect: handTarget,
  };
}

async function runDropAnimation(state, animMeta) {
  const la = state.lastAction;
  if (!la || la.type !== 'dropSwap' || typeof playDropAndDrawAnimation !== 'function') return;

  const isActor = la.playerId === myPlayerId;

  if (!animMeta) {
    const handEl = $('#player-hand');
    const handRect = handEl.getBoundingClientRect();
    animMeta = {
      droppedCards: [],
      sourceRects: [],
      discardRect: $('#discard-top').getBoundingClientRect(),
      drawFrom: la.drawFrom,
      drawSourceRect:
        la.drawFrom === 'deck'
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

  const drawnForAnim = la.drawnCard || { id: 'hidden-draw' };

  isAnimating = true;
  $('#screen-game').classList.add('is-animating');

  try {
    await playDropAndDrawAnimation({
      droppedCards: animMeta.droppedCards || [],
      sourceRects: animMeta.sourceRects || [],
      discardRect: animMeta.discardRect,
      drawFrom: la.drawFrom,
      drawSourceRect: animMeta.drawSourceRect,
      handRect: animMeta.handRect,
      drawnCard: drawnForAnim,
      showDrawnFace: la.showDrawnFace === true,
      renderCardFace: (card) => renderCard(card, false, []),
      renderCardBack: renderCardBackEl,
    });
  } catch (_) {
    /* render anyway */
  }

  isAnimating = false;
  $('#screen-game').classList.remove('is-animating');
}

function applyRoomState(state) {
  roomState = state;
  myPlayerId = state.yourPlayerId || myPlayerId || getPlayerId();
  socketInRoom = true;
  const session = loadSession();
  saveSession(state.code, me()?.name || session?.playerName, state.phase);
  hideReconnecting();
}

async function handleIncomingState(state) {
  const la = state.lastAction;
  const isMyDrop = pendingDropAnim && la?.type === 'dropSwap' && la.playerId === myPlayerId;
  const isOthersDrop = la?.type === 'dropSwap' && la.playerId !== myPlayerId;

  if (la?.type === 'dropSwap') flashDiscardPile();

  if (isMyDrop) {
    const meta = pendingDropAnim;
    pendingDropAnim = null;
    applyRoomState(state);
    render();
    await runDropAnimation(state, meta);
    render();
    return;
  }

  if (isOthersDrop && state.phase === 'playing') {
    applyRoomState(state);
    render();
    await runDropAnimation(state, null);
    render();
    return;
  }

  if (pendingDropAnim) pendingDropAnim = null;

  applyRoomState(state);
  render();
}

function render() {
  if (!roomState) return;
  if (roomState.phase === 'playing') renderGame();
  else renderLobby();
}

function enterRoom(playerName, roomCode, cb) {
  const playerId = getPlayerId();
  const payload = { playerName, playerId };
  const done = (res) => {
    if (!res?.ok) {
      socketInRoom = false;
      cb?.(res);
      return;
    }
    myPlayerId = res.playerId || playerId;
    socketInRoom = true;
    if (res.roomCode) saveSession(res.roomCode, playerName, res.phase);
    cb?.(res);
  };
  if (roomCode) socket.emit('joinRoom', { ...payload, roomCode }, done);
  else socket.emit('createRoom', payload, done);
}

function tryRestoreSession() {
  const session = loadSession();
  if (!session?.roomCode || !session?.playerName || !socket?.connected) return;
  if (socketInRoom || restoringSession) return;

  restoringSession = true;
  showReconnecting(`Rejoining room ${session.roomCode}…`);
  $('#player-name').value = session.playerName;
  $('#room-code').value = session.roomCode;

  enterRoom(session.playerName, session.roomCode, (res) => {
    restoringSession = false;
    if (!res?.ok) {
      hideReconnecting();
      const err = res?.error || 'Could not rejoin';
      if (/not found|closed/i.test(err)) clearSession();
      showError(err);
      roomState = null;
      renderAuth();
      return;
    }
    if (res.phase === 'playing') showScreen('game');
  });
}

function connect() {
  socket = io({ reconnection: true, reconnectionAttempts: Infinity });

  socket.on('connect', () => {
    tryRestoreSession();
  });

  socket.on('disconnect', () => {
    socketInRoom = false;
  });

  socket.on('roomState', (state) => {
    handleIncomingState(state);
  });

  socket.on('roomClosed', () => {
    showToast('Room closed');
    roomState = null;
    socketInRoom = false;
    clearSession();
    hideReconnecting();
    renderAuth();
  });

  const session = loadSession();
  if (session) {
    $('#player-name').value = session.playerName || '';
    $('#room-code').value = session.roomCode || '';
    if (session.roomCode && session.playerName) {
      showReconnecting(
        session.phase === 'playing' ? 'Restoring your game…' : `Rejoining room ${session.roomCode}…`
      );
    }
  }
}

$('#auth-form').addEventListener('submit', (e) => {
  e.preventDefault();
  showError('');
  const name = $('#player-name').value.trim();
  const code = $('#room-code').value.trim().toUpperCase();
  if (!name) {
    showError('Enter your name');
    return;
  }
  if (!socket) connect();

  showReconnecting(code ? `Joining room ${code}…` : 'Creating room…');
  enterRoom(name, code || null, (res) => {
    if (!res?.ok) {
      hideReconnecting();
      showError(res?.error || 'Could not join');
    }
  });
});

$('#btn-start').addEventListener('click', () => {
  socket.emit('startGame', {}, (res) => {
    if (!res?.ok) showToast(res.error);
  });
});

$('#btn-next-round').addEventListener('click', () => {
  socket.emit('nextRound', {}, (res) => {
    if (!res?.ok) showToast(res.error);
  });
});

$('#btn-show').addEventListener('click', () => {
  if (!confirm('Call Show? All hands will be revealed.')) return;
  socket.emit('callShow', {}, (res) => {
    if (!res?.ok) showToast(res.error);
    selectedCardIds.clear();
  });
});

function submitDrop(drawFrom) {
  if (isAnimating) return;
  const hand = me()?.hand || [];
  if (!selectionIsValid(hand)) {
    showToast('Select a valid drop: 1 card or same rank');
    return;
  }

  pendingDropAnim = captureDropAnimationTargets(drawFrom);
  const ids = [...selectedCardIds];
  selectedCardIds.clear();

  $('#btn-drop-only').disabled = true;
  $('#btn-draw-deck').disabled = true;
  $('#btn-draw-discard').disabled = true;

  socket.emit('dropAndSwap', { cardIds: ids, drawFrom }, (res) => {
    if (!res?.ok) {
      pendingDropAnim = null;
      showToast(res.error);
      renderGame();
    }
  });
}

$('#btn-drop-only').addEventListener('click', () => submitDrop('none'));
$('#btn-draw-deck').addEventListener('click', () => submitDrop('deck'));
$('#btn-draw-discard').addEventListener('click', () => submitDrop('discard'));

$('#btn-gameover-close').addEventListener('click', () => {
  $('#overlay-gameover').classList.add('hidden');
});

connect();
