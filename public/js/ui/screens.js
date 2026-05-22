import { $, showScreen } from './dom.js';
import { GAME_PHASE } from '../config.js';
import {
  createCardElement,
  handPoints,
  selectedCardsFromHand,
} from './cards.js';
import { isValidDrop, canDropWithoutDraw } from '/shared/meld.js';

function formatLowestCatchers(catchers) {
  if (!catchers?.length) return 'lowest hand unknown';
  const total = catchers[0].total;
  if (catchers.length === 1) return `${catchers[0].name} has ${total} points`;
  const names = catchers.map((c) => c.name).join(' & ');
  return `${names} have ${total} points`;
}

export function renderAuthScreen() {
  showScreen('auth');
}

export function renderLobbyScreen(state) {
  const { room, myPlayerId } = state;
  showScreen('lobby');

  $('#lobby-room-code').textContent = room.code;
  $('#lobby-phase').textContent =
    room.phase === GAME_PHASE.LOBBY
      ? 'Lobby'
      : room.phase === GAME_PHASE.ROUND_END
        ? `Round ${room.roundNumber} — Results`
        : room.phase === GAME_PHASE.FINISHED
          ? 'Finished'
          : `Round ${room.roundNumber}`;

  const list = $('#player-list');
  list.innerHTML = '';

  for (const player of room.players) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    let label = player.name + (player.isHost ? ' ★' : '') + (player.id === myPlayerId ? ' (you)' : '');
    if (!player.connected) label += ' (away)';
    left.textContent = label;
    if (player.eliminated) left.classList.add('eliminated');

    const right = document.createElement('span');
    right.className = 'score';
    right.textContent = player.eliminated ? 'OUT' : `${player.score} pts`;
    if (player.roundPoints !== null && player.roundPoints !== undefined) {
      right.textContent += ` (+${player.roundPoints})`;
    }
    li.append(left, right);
    list.appendChild(li);
  }

  const me = state.me;
  const host = me?.isHost;
  const playing = room.phase === GAME_PHASE.PLAYING;
  const roundEnd = room.phase === GAME_PHASE.ROUND_END;
  const finished = room.phase === GAME_PHASE.FINISHED;

  $('#btn-start').classList.toggle('hidden', playing || roundEnd || finished);
  $('#btn-next-round').classList.toggle('hidden', !roundEnd);
  $('#btn-reset-game').classList.toggle('hidden', !finished);
  $('#lobby-hint').classList.toggle(
    'hidden',
    room.phase === GAME_PHASE.LOBBY || roundEnd || finished
  );
  $('#lobby-hint').textContent =
    room.phase === GAME_PHASE.LOBBY
      ? 'Waiting to start…'
      : room.phase === GAME_PHASE.ROUND_END
        ? 'Tap Next Round to continue'
        : '';

  const showdownEl = $('#showdown-summary');
  if (room.showdown && roundEnd) {
    showdownEl.classList.remove('hidden');
    const s = room.showdown;
    const caller = room.players.find((p) => p.id === s.callerId);
    let html = `<strong>Showdown</strong> — ${caller?.name || 'Player'} called Show (${s.callerPoints} pts)<br>`;
    if (s.caught) {
      html += `<span class="caught">Caught! Someone has STRICTLY less than ${s.callerPoints} pts. Caller adds 50 pts.</span><br>`;
    } else {
      html += `Successful Show — caller scores 0 (ties are safe).<br>`;
    }
    for (const h of s.hands) {
      const pl = room.players.find((p) => p.id === h.playerId);
      const rp = h.roundPoints ?? room.players.find((p) => p.id === h.playerId)?.roundPoints;
      if (s.caught && h.playerId === s.callerId) {
        html += `${pl?.name}: <strong>+${rp ?? 50}</strong> penalty (${formatLowestCatchers(s.lowestCatchers)})<br>`;
      } else {
        html += `${pl?.name}: ${h.total} pts → +${rp ?? '?'}<br>`;
      }
    }
    showdownEl.innerHTML = html;
  } else {
    showdownEl.classList.add('hidden');
  }

  if (finished && room.winner) {
    $('#gameover-title').textContent = 'Winner!';
    $('#gameover-body').textContent = `${room.winner.name} wins Game 200!`;
    $('#overlay-gameover').classList.remove('hidden');
  }
}

export function renderGameScreen(state, { onCardSelect }) {
  const { room, myPlayerId, selectedCardIds, isAnimating } = state;

  if (
    room.phase === GAME_PHASE.LOBBY ||
    room.phase === GAME_PHASE.ROUND_END ||
    room.phase === GAME_PHASE.FINISHED
  ) {
    state.selectedCardIds.clear();
    renderLobbyScreen(state);
    return;
  }

  showScreen('game');

  const strip = $('#scores-strip');
  strip.innerHTML = '';
  for (const player of room.players) {
    const chip = document.createElement('span');
    chip.className = 'score-chip';
    if (player.id === myPlayerId) chip.classList.add('you');
    if (player.id === room.currentTurnPlayerId) chip.classList.add('turn');
    chip.textContent = `${player.name}: ${player.score}`;
    if (player.eliminated) chip.textContent += ' ✗';
    if (!player.connected) chip.textContent += ' ◌';
    strip.appendChild(chip);
  }

  const turnName = room.players.find((p) => p.id === room.currentTurnPlayerId)?.name;
  $('#turn-indicator').textContent = state.isMyTurn()
    ? 'Your turn — pick cards from YOUR HAND below'
    : `${turnName || '…'}'s turn`;
  $('#deck-info').textContent = `Round ${room.roundNumber}`;

  const discardEl = $('#discard-top');
  discardEl.innerHTML = '';
  discardEl.classList.remove('empty');
  if (room.discardTop) {
    discardEl.appendChild(createCardElement(room.discardTop, { selectable: false }));
  } else {
    discardEl.classList.add('empty');
    discardEl.textContent = '—';
  }
  $('#deck-count').textContent = room.deckCount;

  const logsEl = $('#game-logs');
  if (logsEl) {
    logsEl.innerHTML = (room.logs || [])
      .map((log) => `<div class="log-entry">${log}</div>`)
      .join('');
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  const opponentsEl = $('#opponents');
  opponentsEl.innerHTML = '';
  for (const player of room.players) {
    if (player.id === myPlayerId || player.eliminated) continue;
    const div = document.createElement('div');
    div.className = 'opponent';
    if (player.id === room.currentTurnPlayerId) div.classList.add('turn');
    div.innerHTML = `<strong>${player.name}</strong> — ${player.score} pts`;
    const cards = document.createElement('div');
    cards.className = 'cards';
    cards.textContent = `${player.handCount ?? player.hand?.length ?? 0} cards`;
    div.appendChild(cards);
    opponentsEl.appendChild(div);
  }

  const myHand = state.me?.hand || [];
  const handEl = $('#player-hand');
  handEl.innerHTML = '';
  const canSelect = state.isMyTurn();
  for (const card of myHand) {
    handEl.appendChild(
      createCardElement(card, {
        selectable: canSelect,
        selected: selectedCardIds.has(card.id),
        onSelect: canSelect ? (id) => onCardSelect(id, myHand) : null,
      })
    );
  }
  $('#hand-total').textContent = myHand.length ? `(${handPoints(myHand)} pts)` : '';

  const panel = $('#action-panel');
  const myTurn = state.isMyTurn();
  panel.classList.toggle('hidden', !myTurn);

  const btnShow = $('#btn-show');
  const btnDropOnly = $('#btn-drop-only');
  const btnDeck = $('#btn-draw-deck');
  const btnDiscard = $('#btn-draw-discard');

  if (!myTurn) selectedCardIds.clear();

  if (myTurn && !isAnimating) {
    const selected = selectedCardsFromHand(myHand, selectedCardIds);
    const valid = selected.length > 0 && isValidDrop(selected);
    const matchDiscard = valid && canDropWithoutDraw(selected, room.discardTop);

    $('#action-hint').textContent =
      selectedCardIds.size === 0
        ? 'Tap hand cards: 1 card or same rank (2+) — then draw'
        : matchDiscard
          ? 'Matches discard rank — drop without drawing'
          : valid
            ? 'Valid drop — choose deck or discard pile to draw 1 card'
            : 'Keep selecting: need same rank (set)';

    btnShow.classList.toggle('hidden', !room.canShow);
    btnDropOnly.classList.toggle('hidden', !matchDiscard);
    btnDeck.classList.toggle('hidden', matchDiscard);
    btnDiscard.classList.toggle('hidden', matchDiscard);
    btnDropOnly.disabled = !matchDiscard;
    btnDeck.textContent = 'Drop & Draw Deck';
    btnDiscard.textContent = 'Drop & Take Discard';
    btnDeck.disabled = !valid || matchDiscard || room.deckCount === 0;
    btnDiscard.disabled = !valid || matchDiscard || !room.discardTop;
  } else {
    btnDropOnly.classList.add('hidden');
    btnDeck.classList.add('hidden');
    btnDiscard.classList.add('hidden');
    btnShow.classList.add('hidden');
  }
}

export function renderRoom(state, handlers) {
  if (!state.room) return;
  if (state.room.phase === GAME_PHASE.PLAYING) {
    renderGameScreen(state, handlers);
  } else {
    renderLobbyScreen(state);
  }
}
