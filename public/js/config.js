export const STORAGE_KEYS = Object.freeze({
  playerId: 'game200_playerId',
  session: 'game200_session',
});

export const SUIT_SYMBOL = Object.freeze({
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
});

export const RED_SUITS = new Set(['hearts', 'diamonds']);

export const GAME_PHASE = Object.freeze({
  LOBBY: 'lobby',
  PLAYING: 'playing',
  ROUND_END: 'roundEnd',
  FINISHED: 'finished',
});

export const TOAST_MS = 3200;
