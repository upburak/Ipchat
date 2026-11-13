import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveServer } from '../src/resolve-server.js';
import { loadConfig, saveConfig } from '../src/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-rs-'));
const A = { url: 'http://10.0.0.1:3000', name: 'a' };
const B = { url: 'http://10.0.0.2:3000', name: 'b' };

function deps({ servers = [], up = [] } = {}) {
  const calls = { discover: 0 };
  return {
    calls,
    discover: async () => {
      calls.discover++;
      return servers;
    },
    reachable: async (url) => up.includes(url),
  };
}

test('uses remembered server when reachable', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d = deps({ up: [A.url] });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: A.url });
  assert.equal(d.calls.discover, 0);
});

test('rediscovers when remembered server is unreachable and saves the new one', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000' });
  const d = deps({ servers: [B] });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url });
  assert.equal(loadConfig(configDir).lastServer, B.url);
});

test('prefers remembered server among several discovered', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: B.url });
  const d = deps({ servers: [A, B] });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url });
});

test('returns choose for several unknown servers', async () => {
  const d = deps({ servers: [A, B] });
  assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'choose', servers: [A, B] });
});

test('returns manual when nothing found', async () => {
  const d = deps();
  assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'manual' });
});

test('does not loop: calls discover at most once per resolve', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000' });
  const d = deps();
  await resolveServer({ configDir, ...d });
  assert.equal(d.calls.discover, 1);
});
