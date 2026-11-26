import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { verifyServer } from '../src/verify-server.js';
import { loadOrCreateIdentity } from '../../server/src/identity.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-vs-'));
const NONCE = 'ab'.repeat(32);
const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

// Gerçek node:http sunucusu (ephemeral port). Her test kendi davranışını verir.
async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(url);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

// Gerçek sunucu modülüyle imzalanmış /api/identity yanıtı üretir.
function identityReply(identity, nonce) {
  return {
    app: 'ipchat',
    publicKey: identity.publicKey,
    fingerprint: identity.fingerprint,
    signature: identity.sign(nonce),
  };
}

// Doğru davranan sunucu: istemcinin gönderdiği nonce'u imzalar.
const honest = (identity) => (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/identity') return sendJson(res, 200, identityReply(identity, u.searchParams.get('nonce')));
  sendJson(res, 404, {});
};

test('known when the fingerprint matches the pin', async () => {
  const id = loadOrCreateIdentity(tmp());
  await withServer(honest(id), async (url) => {
    const r = await verifyServer(url, { fingerprint: id.fingerprint, publicKey: id.publicKey }, { nonce: NONCE });
    assert.deepEqual(r, { state: 'known', identity: { publicKey: id.publicKey, fingerprint: id.fingerprint } });
  });
});

test('new when nothing is pinned', async () => {
  const id = loadOrCreateIdentity(tmp());
  await withServer(honest(id), async (url) => {
    const r = await verifyServer(url, undefined, { nonce: NONCE });
    assert.deepEqual(r, { state: 'new', identity: { publicKey: id.publicKey, fingerprint: id.fingerprint } });
  });
});

test('works with a generated nonce when none is injected', async () => {
  const id = loadOrCreateIdentity(tmp());
  await withServer(honest(id), async (url) => {
    const r = await verifyServer(url, undefined);
    assert.equal(r.state, 'new');
  });
});

test('changed when a different identity is pinned', async () => {
  const id = loadOrCreateIdentity(tmp());
  const other = loadOrCreateIdentity(tmp());
  await withServer(honest(id), async (url) => {
    const r = await verifyServer(url, { fingerprint: other.fingerprint, publicKey: other.publicKey }, { nonce: NONCE });
    assert.deepEqual(r, { state: 'changed', identity: { publicKey: id.publicKey, fingerprint: id.fingerprint } });
  });
});

const legacyHandler = (health) => (req, res) => {
  if (req.url.startsWith('/api/health')) return health(res);
  sendJson(res, 404, { error: 'yok' });
};
const ipchatHealth = (res) => sendJson(res, 200, { ok: true, app: 'ipchat' });

test('legacy server without the endpoint is unsupported when nothing is pinned', async () => {
  await withServer(legacyHandler(ipchatHealth), async (url) => {
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'unsupported' });
  });
});

test('legacy server without the endpoint is changed with legacy=true when something is pinned', async () => {
  const pinned = loadOrCreateIdentity(tmp());
  await withServer(legacyHandler(ipchatHealth), async (url) => {
    const r = await verifyServer(url, { fingerprint: pinned.fingerprint, publicKey: pinned.publicKey }, { nonce: NONCE });
    assert.deepEqual(r, { state: 'changed', legacy: true });
  });
});

test('a non-ipchat web server that answers 404 is unreachable, not unsupported', async () => {
  const cases = {
    'other app': (res) => sendJson(res, 200, { ok: true, app: 'x' }),
    'health 404': (res) => sendJson(res, 404, {}),
    'health not json': (res) => {
      res.writeHead(200);
      res.end('<html>merhaba</html>');
    },
  };
  for (const [name, health] of Object.entries(cases)) {
    await withServer(legacyHandler(health), async (url) => {
      assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'unreachable' }, name);
    });
  }
});

test('a reply signed for another nonce is invalid', async () => {
  const id = loadOrCreateIdentity(tmp());
  const stale = identityReply(id, 'cd'.repeat(32)); // eski, sabit yanıt (tekrar saldırısı)
  await withServer((req, res) => sendJson(res, 200, stale), async (url) => {
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'invalid' });
  });
});

test('non-json body is invalid', async () => {
  await withServer((req, res) => {
    res.writeHead(200);
    res.end('bu json degil');
  }, async (url) => {
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'invalid' });
  });
});

test('400 is invalid', async () => {
  await withServer((req, res) => sendJson(res, 400, { error: 'nonce' }), async (url) => {
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'invalid' });
  });
});

test('other status codes are unreachable', async () => {
  await withServer((req, res) => sendJson(res, 500, {}), async (url) => {
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'unreachable' });
  });
});

test('a 1 MB body is invalid and does not hang', async () => {
  let written = 0;
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    const chunk = Buffer.alloc(16 * 1024, 0x61);
    const pump = () => {
      // İstemci akışı keserse yazmayı bırak.
      while (written < 1024 * 1024 && !res.destroyed) {
        written += chunk.length;
        if (!res.write(chunk)) return res.once('drain', pump);
      }
      if (!res.destroyed) res.end();
    };
    pump();
  }, async (url) => {
    const t0 = Date.now();
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'invalid' });
    assert.ok(Date.now() - t0 < 1000, 'hizli donmeli');
  });
});

test('a server that never answers is unreachable within the timeout', async () => {
  await withServer(() => {}, async (url) => {
    const t0 = Date.now();
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE, timeoutMs: 200 }), { state: 'unreachable' });
    assert.ok(Date.now() - t0 < 1500, 'zaman asimi isledi');
  });
});

test('a server that stalls mid-body is unreachable within the timeout', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"app":'); // gövdeyi bitirmez
  }, async (url) => {
    const t0 = Date.now();
    assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE, timeoutMs: 200 }), { state: 'unreachable' });
    assert.ok(Date.now() - t0 < 1500, 'zaman asimi isledi');
  });
});

test('connection refused is unreachable', async () => {
  // Port al, kapat: o porta artık kimse dinlemiyor.
  const s = http.createServer();
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${s.address().port}`;
  await new Promise((resolve) => s.close(resolve));
  assert.deepEqual(await verifyServer(url, undefined, { nonce: NONCE }), { state: 'unreachable' });
});

test('never throws on a hostile fetchImpl', async () => {
  const boom = async () => {
    throw new Error('patladi');
  };
  assert.deepEqual(await verifyServer('http://127.0.0.1:1', undefined, { fetchImpl: boom }), { state: 'unreachable' });
});

test('the body is read through a bounded reader: stops at 4 KB and cancels the stream', async () => {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      pulled += 1024;
      controller.enqueue(new Uint8Array(1024).fill(0x61));
    },
    cancel() {
      cancelled = true;
    },
  });
  const fetchImpl = async () => new Response(stream, { status: 200 });
  assert.deepEqual(await verifyServer('http://x', undefined, { fetchImpl, nonce: NONCE }), { state: 'invalid' });
  assert.ok(pulled <= 4096 + 2048, `cok fazla okundu: ${pulled}`);
  assert.equal(cancelled, true);
});
