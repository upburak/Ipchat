import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDiscovery } from '../../server/src/discovery.js';
import { discoverServers } from '../src/discovery-client.js';

test('finds a server that answers on loopback', async () => {
  const d = await startDiscovery(3000, { udpPort: 0, name: 'sunucu-pc' });
  try {
    const found = await discoverServers({ udpPort: d.port, broadcastAddress: '127.0.0.1', timeoutMs: 500 });
    assert.deepEqual(found, [{ url: 'http://127.0.0.1:3000', name: 'sunucu-pc' }]);
  } finally {
    d.close();
  }
});

test('returns an empty list on timeout', async () => {
  const found = await discoverServers({ udpPort: 41999, broadcastAddress: '127.0.0.1', timeoutMs: 200 });
  assert.deepEqual(found, []);
});

test('deduplicates the same server answering twice', async () => {
  const a = await startDiscovery(3000, { udpPort: 0, name: 'a' });
  try {
    const found = await discoverServers({ udpPort: a.port, broadcastAddress: '127.0.0.1', timeoutMs: 400 });
    assert.equal(found.length, 1);
  } finally {
    a.close();
  }
});
