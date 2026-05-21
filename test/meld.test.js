import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDrop, canDropWithoutDraw, isSet, isRun } from '../shared/meld.js';

describe('meld rules', () => {
  const sevenHearts = { id: '1', suit: 'hearts', rank: '7', isJoker: false };
  const sevenSpades = { id: '2', suit: 'spades', rank: '7', isJoker: false };
  const eightHearts = { id: '3', suit: 'hearts', rank: '8', isJoker: false };

  it('accepts a single card drop', () => {
    assert.equal(isValidDrop([sevenHearts]), true);
  });

  it('accepts a rank set', () => {
    assert.equal(isSet([sevenHearts, sevenSpades]), true);
    assert.equal(isValidDrop([sevenHearts, sevenSpades]), true);
  });

  it('accepts a suited run of three', () => {
    const run = [sevenHearts, eightHearts, { id: '4', suit: 'hearts', rank: '9', isJoker: false }];
    assert.equal(isRun(run), true);
    assert.equal(isValidDrop(run), true);
  });

  it('allows drop without draw when rank matches discard', () => {
    const discard = { id: 'd', suit: 'clubs', rank: '7', isJoker: false };
    assert.equal(canDropWithoutDraw([sevenHearts], discard), true);
    assert.equal(canDropWithoutDraw([sevenHearts, sevenSpades], discard), true);
  });
});
