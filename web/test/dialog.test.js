import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogOutcome, pollingPaused } from '../src/lib/dialog.js';

test('Escape ve arka plan tiklamasi her zaman iptal eder', () => {
  assert.equal(dialogOutcome({ key: 'Escape' }), 'cancel');
  assert.equal(dialogOutcome({ isBackdrop: true }), 'cancel');
  assert.equal(dialogOutcome({ key: 'Escape', isBackdrop: true }), 'cancel');
});

test('Enter ve diger tuslar onaylamaz', () => {
  for (const key of ['Enter', ' ', 'a', 'Tab']) assert.equal(dialogOutcome({ key }), null);
  assert.equal(dialogOutcome({}), null);
});

test('yenileme yalnizca fare listede VE pencere odaktayken duraklar', () => {
  assert.equal(pollingPaused({ hovering: true, windowFocused: true }), true);
  assert.equal(pollingPaused({ hovering: true, windowFocused: false }), false);
  assert.equal(pollingPaused({ hovering: false, windowFocused: true }), false);
  assert.equal(pollingPaused({ hovering: false, windowFocused: false }), false);
});
