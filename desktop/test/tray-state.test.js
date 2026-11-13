import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyState } from '../src/tray-state.js';

test('applyState reports no change for equal values and arrays', () => {
  const state = { running: true, urls: ['a', 'b'], badge: 2 };
  assert.equal(applyState(state, { running: true, urls: ['a', 'b'], badge: 2 }), false);
});

test('applyState reports and applies changes', () => {
  const state = { running: false, urls: [], badge: 0 };
  assert.equal(applyState(state, { badge: 3 }), true);
  assert.equal(state.badge, 3);
  assert.equal(applyState(state, { urls: ['x'] }), true);
  assert.deepEqual(state.urls, ['x']);
});
