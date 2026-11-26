import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { createIdentityRouter } = await import('../src/routes/identity.js');
const { loadOrCreateIdentity, fingerprintOf, IDENTITY_PREFIX } = await import('../src/identity.js');

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-identity-route-'));
  const identity = loadOrCreateIdentity(dir);
  const app = express();
  app.use('/api', createIdentityRouter(identity));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, identity);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const NONCE_A = 'a'.repeat(64);
const NONCE_B = 'b'.repeat(64);

test('serves a verifiable identity for a valid nonce', async () => {
  await withServer(async (base, identity) => {
    const res = await fetch(`${base}/api/identity?nonce=${NONCE_A}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.app, 'ipchat');
    assert.equal(body.publicKey, identity.publicKey);
    assert.equal(body.fingerprint, fingerprintOf(body.publicKey));
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(body.publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const ok = crypto.verify(
      null,
      Buffer.from(IDENTITY_PREFIX + NONCE_A),
      publicKey,
      Buffer.from(body.signature, 'base64')
    );
    assert.equal(ok, true);
  });
});

test('rejects a missing nonce with 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/identity`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Geçersiz sınama değeri' });
  });
});

test('rejects a nonce that is not 64 lowercase hex with 400', async () => {
  await withServer(async (base) => {
    const bad = ['abc', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), ''];
    for (const nonce of bad) {
      const res = await fetch(`${base}/api/identity?nonce=${nonce}`);
      assert.equal(res.status, 400, `nonce=${nonce}`);
      assert.deepEqual(await res.json(), { error: 'Geçersiz sınama değeri' });
    }
    const res = await fetch(`${base}/api/identity?nonce=${NONCE_A}&nonce=${NONCE_B}`);
    assert.equal(res.status, 400);
  });
});

test('different nonces give different signatures', async () => {
  await withServer(async (base) => {
    const a = await (await fetch(`${base}/api/identity?nonce=${NONCE_A}`)).json();
    const b = await (await fetch(`${base}/api/identity?nonce=${NONCE_B}`)).json();
    assert.notEqual(a.signature, b.signature);
  });
});
