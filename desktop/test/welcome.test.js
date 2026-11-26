import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_VERSION, needsWelcome, welcomeRecord } from '../src/welcome.js';

test('WELCOME_VERSION starts at 1', () => {
  assert.equal(WELCOME_VERSION, 1);
});

test('needsWelcome is true when packaged and no record exists', () => {
  assert.equal(needsWelcome({}, true), true);
});

test('needsWelcome is false when the accepted version equals the current one', () => {
  assert.equal(needsWelcome({ welcomeAccepted: { version: 1 } }, true), false);
});

test('needsWelcome is true when the accepted version is 0', () => {
  assert.equal(needsWelcome({ welcomeAccepted: { version: 0 } }, true), true);
});

test('needsWelcome is true when the accepted version is a string', () => {
  assert.equal(needsWelcome({ welcomeAccepted: { version: '1' } }, true), true);
});

test('needsWelcome is false in development even without a record', () => {
  assert.equal(needsWelcome({}, false), false);
  assert.equal(needsWelcome(null, false), false);
});

test('needsWelcome treats a broken config as not accepted (never consent)', () => {
  for (const broken of [null, undefined, [], 'x', 5, true]) {
    assert.equal(needsWelcome(broken, true), true, `config: ${JSON.stringify(broken)}`);
  }
});

test('needsWelcome treats a malformed welcomeAccepted as not accepted', () => {
  for (const bad of [null, [], 'x', 1, { version: null }, { version: NaN }, { at: 'x' }]) {
    assert.equal(needsWelcome({ welcomeAccepted: bad }, true), true, `welcomeAccepted: ${JSON.stringify(bad)}`);
  }
});

test('needsWelcome accepts a future version as consent', () => {
  assert.equal(needsWelcome({ welcomeAccepted: { version: 2 } }, true), false);
});

test('welcomeRecord holds the current version and an ISO timestamp', () => {
  const now = new Date('2026-11-26T10:20:30.000Z');
  assert.deepEqual(welcomeRecord(now), { version: WELCOME_VERSION, at: '2026-11-26T10:20:30.000Z' });
});
