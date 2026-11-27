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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('windowOptions() carries the dark background colour equal to web --bg', () => {
  const css = readFileSync(fileURLToPath(new URL('../../web/src/style.css', import.meta.url)), 'utf8');
  const bg = /:root\[data-theme=['"]koyu['"]\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})\s*;/i.exec(css);
  assert.ok(bg, 'web --bg bulunamadi');
  const o = windowOptions();
  assert.equal(typeof o.backgroundColor, 'string');
  assert.equal(o.backgroundColor.toLowerCase(), bg[1].toLowerCase());
});
