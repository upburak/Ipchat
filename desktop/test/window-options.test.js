import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowOptions } from '../src/window-options.js';

test('window options are fixed 800x620 and not resizable', () => {
  const o = windowOptions();
  assert.equal(o.width, 800);
  assert.equal(o.height, 620);
  assert.equal(o.resizable, false);
  assert.equal(o.maximizable, false);
  assert.equal(o.fullscreenable, false);
});
