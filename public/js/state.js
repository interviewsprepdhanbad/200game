/** Central client state — single object passed to renderers. */

export class AppState {
  constructor() {
    this.room = null;
    this.myPlayerId = null;
    this.selectedCardIds = new Set();
    this.pendingDropAnim = null;
    this.isAnimating = false;
    this.socketInRoom = false;
    this.restoringSession = false;
  }

  get me() {
    return this.room?.players?.find((p) => p.id === this.myPlayerId) ?? null;
  }

  isMyTurn() {
    return (
      this.room?.phase === 'playing' &&
      this.room?.currentTurnPlayerId === this.myPlayerId
    );
  }

  applyRoomState(state) {
    this.room = state;
    this.myPlayerId = state.yourPlayerId ?? this.myPlayerId;
    this.socketInRoom = true;
  }

  clearRoom() {
    this.room = null;
    this.socketInRoom = false;
    this.selectedCardIds.clear();
    this.pendingDropAnim = null;
  }
}
