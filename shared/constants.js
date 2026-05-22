/** Game rules and limits — single source of truth for server and docs. */

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_ORDER = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
};

export const ELIMINATION_SCORE = 200;
export const STARTING_HAND_SIZE = 5;
export const CAUGHT_PENALTY = 50;
export const MAX_PLAYERS_PER_ROOM = 8;
export const MIN_PLAYERS_TO_START = 2;
export const PLAYER_NAME_MAX_LENGTH = 20;
export const ROOM_CODE_LENGTH = 6;

export const GAME_PHASE = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  ROUND_END: 'roundEnd',
  FINISHED: 'finished',
};

export const DRAW_SOURCE = {
  DECK: 'deck',
  DISCARD: 'discard',
  NONE: 'none',
};
