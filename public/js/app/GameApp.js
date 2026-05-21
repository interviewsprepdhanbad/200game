import { GAME_PHASE } from '../config.js';
import { AppState } from '../state.js';
import {
  getPlayerId,
  saveSession,
  clearSession,
  loadSession,
} from '../session.js';
import {
  $,
  showScreen,
  showAuthError,
  showReconnecting,
  hideReconnecting,
} from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { toggleCardSelection } from '../ui/cards.js';
import { renderAuthScreen, renderRoom } from '../ui/screens.js';
import { isValidDrop } from '/shared/meld.js';
import { selectedCardsFromHand } from '../ui/cards.js';
import {
  flashDiscardPile,
  captureDropAnimationTargets,
  runDropAnimation,
} from '../game/dropAnimation.js';

export class GameApp {
  constructor() {
    this.state = new AppState();
    this.socket = null;
  }

  init() {
    this.bindUi();
    this.connectSocket();
    this.prefillAuthForm();
    this.maybeShowReconnectOverlay();
  }

  bindUi() {
    $('#auth-form').addEventListener('submit', (event) => this.onAuthSubmit(event));
    $('#btn-start').addEventListener('click', () => this.emitAction('startGame'));
    $('#btn-next-round').addEventListener('click', () => this.emitAction('nextRound'));
    $('#btn-show').addEventListener('click', () => this.onCallShow());
    $('#btn-drop-only').addEventListener('click', () => this.submitDrop('none'));
    $('#btn-draw-deck').addEventListener('click', () => this.submitDrop('deck'));
    $('#btn-draw-discard').addEventListener('click', () => this.submitDrop('discard'));
    $('#btn-gameover-close').addEventListener('click', () => {
      $('#overlay-gameover').classList.add('hidden');
    });
  }

  prefillAuthForm() {
    const session = loadSession();
    if (!session) return;
    $('#player-name').value = session.playerName || '';
    $('#room-code').value = session.roomCode || '';
  }

  maybeShowReconnectOverlay() {
    const session = loadSession();
    if (!session?.roomCode || !session?.playerName) return;
    showReconnecting(
      session.phase === GAME_PHASE.PLAYING
        ? 'Restoring your game…'
        : `Rejoining room ${session.roomCode}…`
    );
  }

  connectSocket() {
    this.socket = io({ reconnection: true, reconnectionAttempts: Infinity });

    this.socket.on('connect', () => this.tryRestoreSession());
    this.socket.on('disconnect', () => {
      this.state.socketInRoom = false;
    });
    this.socket.on('roomState', (state) => this.handleRoomState(state));
    this.socket.on('roomClosed', () => this.handleRoomClosed());
  }

  render() {
    renderRoom(this.state, {
      onCardSelect: (cardId, hand) => {
        toggleCardSelection(this.state, cardId, hand);
        this.render();
      },
    });
  }

  applyRoomState(state) {
    this.state.applyRoomState(state);
    const session = loadSession();
    saveSession(state.code, this.state.me?.name || session?.playerName, state.phase);
    hideReconnecting();
  }

  async handleRoomState(state) {
    const lastAction = state.lastAction;
    const isMyDrop =
      this.state.pendingDropAnim &&
      lastAction?.type === 'dropSwap' &&
      lastAction.playerId === this.state.myPlayerId;
    const isOthersDrop =
      lastAction?.type === 'dropSwap' && lastAction.playerId !== this.state.myPlayerId;

    if (lastAction?.type === 'dropSwap') flashDiscardPile();

    if (isMyDrop) {
      const meta = this.state.pendingDropAnim;
      this.state.pendingDropAnim = null;
      this.applyRoomState(state);
      this.render();
      await runDropAnimation(this.state, meta);
      this.render();
      return;
    }

    if (isOthersDrop && state.phase === GAME_PHASE.PLAYING) {
      this.applyRoomState(state);
      this.render();
      await runDropAnimation(this.state, null);
      this.render();
      return;
    }

    if (this.state.pendingDropAnim) this.state.pendingDropAnim = null;
    this.applyRoomState(state);
    this.render();
  }

  handleRoomClosed() {
    showToast('Room closed');
    this.state.clearRoom();
    clearSession();
    hideReconnecting();
    renderAuthScreen();
  }

  enterRoom(playerName, roomCode) {
    return new Promise((resolve) => {
      const playerId = getPlayerId();
      const payload = { playerName, playerId };
      const onAck = (response) => {
        if (!response?.ok) {
          this.state.socketInRoom = false;
          resolve(response);
          return;
        }
        this.state.myPlayerId = response.playerId || playerId;
        this.state.socketInRoom = true;
        if (response.roomCode) {
          saveSession(response.roomCode, playerName, response.phase);
        }
        resolve(response);
      };

      if (roomCode) {
        this.socket.emit('joinRoom', { ...payload, roomCode }, onAck);
      } else {
        this.socket.emit('createRoom', payload, onAck);
      }
    });
  }

  async tryRestoreSession() {
    const session = loadSession();
    if (!session?.roomCode || !session?.playerName || !this.socket?.connected) return;
    if (this.state.socketInRoom || this.state.restoringSession) return;

    this.state.restoringSession = true;
    showReconnecting(`Rejoining room ${session.roomCode}…`);
    $('#player-name').value = session.playerName;
    $('#room-code').value = session.roomCode;

    const response = await this.enterRoom(session.playerName, session.roomCode);
    this.state.restoringSession = false;

    if (!response?.ok) {
      hideReconnecting();
      const error = response?.error || 'Could not rejoin';
      if (/not found|closed/i.test(error)) clearSession();
      showAuthError(error);
      this.state.clearRoom();
      renderAuthScreen();
      return;
    }

    if (response.phase === GAME_PHASE.PLAYING) {
      showScreen('game');
    }
  }

  async onAuthSubmit(event) {
    event.preventDefault();
    showAuthError('');

    const name = $('#player-name').value.trim();
    const code = $('#room-code').value.trim().toUpperCase();
    if (!name) {
      showAuthError('Enter your name');
      return;
    }

    if (!this.socket) this.connectSocket();

    showReconnecting(code ? `Joining room ${code}…` : 'Creating room…');
    const response = await this.enterRoom(name, code || null);
    if (!response?.ok) {
      hideReconnecting();
      showAuthError(response?.error || 'Could not join');
    }
  }

  emitAction(eventName) {
    this.socket.emit(eventName, {}, (response) => {
      if (!response?.ok) showToast(response.error);
    });
  }

  onCallShow() {
    if (!confirm('Call Show? All hands will be revealed.')) return;
    this.socket.emit('callShow', {}, (response) => {
      if (!response?.ok) showToast(response.error);
      this.state.selectedCardIds.clear();
    });
  }

  submitDrop(drawFrom) {
    if (this.state.isAnimating) return;

    const hand = this.state.me?.hand || [];
    const selected = selectedCardsFromHand(hand, this.state.selectedCardIds);
    if (!selected.length || !isValidDrop(selected)) {
      showToast('Select a valid drop: 1 card or same rank');
      return;
    }

    this.state.pendingDropAnim = captureDropAnimationTargets(this.state, drawFrom);
    const cardIds = [...this.state.selectedCardIds];
    this.state.selectedCardIds.clear();

    $('#btn-drop-only').disabled = true;
    $('#btn-draw-deck').disabled = true;
    $('#btn-draw-discard').disabled = true;

    this.socket.emit('dropAndSwap', { cardIds, drawFrom }, (response) => {
      if (!response?.ok) {
        this.state.pendingDropAnim = null;
        showToast(response.error);
        this.render();
      }
    });
  }
}
