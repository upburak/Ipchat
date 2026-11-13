import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, saveConfig } from '../src/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-cfg-'));

test('loadConfig returns {} for missing or corrupt file', () => {
  const dir = tmp();
  assert.deepEqual(loadConfig(dir), {});
  fs.writeFileSync(path.join(dir, 'config.json'), '{bozuk');
  assert.deepEqual(loadConfig(dir), {});
});

test('saveConfig then loadConfig round-trips', () => {
  const dir = path.join(tmp(), 'alt', 'klasor');
  saveConfig(dir, { lastServer: 'http://1.2.3.4:3000' });
  assert.deepEqual(loadConfig(dir), { lastServer: 'http://1.2.3.4:3000' });
});
