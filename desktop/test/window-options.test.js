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

import { webPreferences } from '../src/window-options.js';

test('webPreferences disables background throttling and keeps isolation', () => {
  const p = webPreferences('/x/preload.cjs');
  assert.equal(p.preload, '/x/preload.cjs');
  assert.equal(p.backgroundThrottling, false);
  assert.equal(p.contextIsolation, true);
  assert.equal(p.nodeIntegration, false);
  assert.equal(p.sandbox, true);
});
