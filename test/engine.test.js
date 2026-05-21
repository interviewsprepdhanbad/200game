import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deckCountForPlayers,
  createDeck,
  handTotal,
  resolveShow,
  canCallShow,
} from '../src/game/engine.js';

describe('game engine', () => {
  it('scales deck count with player count', () => {
    assert.equal(deckCountForPlayers(4), 1);
    assert.equal(deckCountForPlayers(5), 2);
    assert.equal(deckCountForPlayers(10), 3);
  });

  it('builds a shuffled deck with jokers', () => {
    const deck = createDeck(2);
    assert.equal(deck.length, 54);
    assert.ok(deck.some((c) => c.isJoker));
  });

  it('scores hands with aces and face cards', () => {
    const hand = [
      { id: '1', suit: 'hearts', rank: 'A', isJoker: false },
      { id: '2', suit: 'hearts', rank: 'K', isJoker: false },
      { id: '3', suit: null, rank: 'Joker', isJoker: true },
    ];
    assert.equal(handTotal(hand), 11);
  });

  it('unlocks show after each player has had a turn', () => {
    assert.equal(canCallShow(1, 3), false);
    assert.equal(canCallShow(3, 3), true);
  });

  it('penalizes a caught show caller', () => {
    const hands = [
      { playerId: 'a', isCaller: true, hand: [{ id: '1', suit: 'hearts', rank: '10', isJoker: false }] },
      { playerId: 'b', isCaller: false, hand: [{ id: '2', suit: 'clubs', rank: '2', isJoker: false }] },
    ];
    const { caught, results } = resolveShow(hands);
    assert.equal(caught, true);
    assert.equal(results.find((r) => r.playerId === 'a').roundPoints, 50);
  });
});
