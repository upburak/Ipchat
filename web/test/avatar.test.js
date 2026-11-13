import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, avatarColor, PALETTE } from '../src/lib/avatar.js';

test('initial uppercases the first letter (Turkish aware) and handles empty', () => {
  assert.equal(initial('ayşe'), 'A');
  assert.equal(initial('ışık'), 'I');
  assert.equal(initial('ilker'), 'İ');
  assert.equal(initial('  mehmet'), 'M');
  assert.equal(initial(''), '?');
  assert.equal(initial(undefined), '?');
});

test('avatarColor is deterministic and comes from the palette', () => {
  for (const name of ['ayşe', 'mehmet', 'zeynep', 'q', '']) {
    assert.equal(avatarColor(name), avatarColor(name));
    assert.ok(PALETTE.includes(avatarColor(name)));
  }
});
