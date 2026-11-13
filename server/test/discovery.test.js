import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';

const { startDiscovery } = await import('../src/discovery.js');

function ask(port, message, waitMs = 1000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      client.close();
      resolve(null);
    }, waitMs);
    client.on('message', (msg) => {
      clearTimeout(timer);
      client.close();
      resolve(msg.toString());
    });
    client.send(message, port, '127.0.0.1');
  });
}

test('answers IPCHAT_DISCOVER with app, port and name', async () => {
  const d = await startDiscovery(3000, { udpPort: 0, name: 'test-pc' });
  try {
    const reply = await ask(d.port, 'IPCHAT_DISCOVER');
    assert.deepEqual(JSON.parse(reply), { app: 'ipchat', port: 3000, name: 'test-pc' });
  } finally {
    d.close();
  }
});

test('ignores unrelated packets', async () => {
  const d = await startDiscovery(3000, { udpPort: 0, name: 'test-pc' });
  try {
    assert.equal(await ask(d.port, 'merhaba', 300), null);
  } finally {
    d.close();
  }
});
