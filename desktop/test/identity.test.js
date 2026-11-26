import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  IDENTITY_PREFIX,
  IDENTITY_EXIT_CODE,
  makeNonce,
  fingerprintOf,
  shortFingerprint,
  verifyIdentityReply,
} from '../src/identity.js';
import * as server from '../../server/src/identity.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-id-'));

function realReply(nonce) {
  const identity = server.loadOrCreateIdentity(tmp());
  return {
    identity,
    reply: {
      app: 'ipchat',
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      signature: identity.sign(nonce),
    },
  };
}

test("prefix matches the server's prefix", () => {
  assert.equal(IDENTITY_PREFIX, server.IDENTITY_PREFIX);
  assert.equal(IDENTITY_PREFIX, 'ipchat-kimlik-v1:');
});

test("identity exit code matches the server's exit code", () => {
  assert.equal(IDENTITY_EXIT_CODE, server.IDENTITY_EXIT_CODE);
  assert.equal(IDENTITY_EXIT_CODE, 78);
});

test('accepts a real signed reply from the server module', () => {
  const nonce = makeNonce();
  const { identity, reply } = realReply(nonce);
  const result = verifyIdentityReply(reply, nonce);
  assert.deepEqual(result, { ok: true, publicKey: identity.publicKey, fingerprint: identity.fingerprint });
});

test('accepts a reply without a fingerprint field', () => {
  const nonce = makeNonce();
  const { identity, reply } = realReply(nonce);
  delete reply.fingerprint;
  const result = verifyIdentityReply(reply, nonce);
  assert.equal(result.ok, true);
  assert.equal(result.fingerprint, identity.fingerprint);
});

test("fingerprintOf equals the server's fingerprint", () => {
  const { identity } = realReply(makeNonce());
  assert.equal(fingerprintOf(identity.publicKey), identity.fingerprint);
  assert.match(fingerprintOf(identity.publicKey), /^[0-9a-f]{64}$/);
});

test('shortFingerprint formats 12 uppercase hex chars in groups of 4', () => {
  const fp = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  assert.equal(shortFingerprint(fp), 'A1B2-C3D4-E5F6');
  assert.equal(shortFingerprint(fp.toUpperCase()), 'A1B2-C3D4-E5F6');
  assert.match(shortFingerprint(fp), /^[0-9A-F]{4}(-[0-9A-F]{4}){2}$/);
});

test('shortFingerprint never throws on bad input', () => {
  for (const bad of [undefined, null, 42, {}, [], '', 'zz', 'x'.repeat(100000)]) {
    assert.doesNotThrow(() => shortFingerprint(bad));
  }
  assert.equal(typeof shortFingerprint(undefined), 'string');
});

test('rejects a signature made for a different nonce (replay)', () => {
  const nonceA = makeNonce();
  const nonceB = makeNonce();
  const { reply } = realReply(nonceA);
  // Önceden geçerli olan yanıt, kendi nonce'unda doğrulanır...
  assert.equal(verifyIdentityReply(reply, nonceA).ok, true);
  // ...ama aynı yanıt başka bir meydan okumaya karşı tekrar oynatılamaz.
  assert.deepEqual(verifyIdentityReply(reply, nonceB), { ok: false });
});

test('rejects a reply whose fingerprint field does not match its key', () => {
  const nonce = makeNonce();
  const { reply } = realReply(nonce);
  const other = server.loadOrCreateIdentity(tmp());
  assert.deepEqual(verifyIdentityReply({ ...reply, fingerprint: other.fingerprint }, nonce), { ok: false });
  assert.deepEqual(verifyIdentityReply({ ...reply, fingerprint: 'abc' }, nonce), { ok: false });
});

test('rejects a signature made by another key', () => {
  const nonce = makeNonce();
  const { reply } = realReply(nonce);
  const other = server.loadOrCreateIdentity(tmp());
  assert.deepEqual(verifyIdentityReply({ ...reply, signature: other.sign(nonce) }, nonce), { ok: false });
});

test('rejects wrong app, missing fields, non-string fields, bad keys, oversized fields; never throws', () => {
  const nonce = makeNonce();
  const { reply } = realReply(nonce);
  const rsa = crypto
    .generateKeyPairSync('rsa', { modulusLength: 1024 })
    .publicKey.export({ type: 'spki', format: 'der' })
    .toString('base64');

  const cases = [
    undefined,
    null,
    42,
    'ipchat',
    [],
    {},
    { ...reply, app: 'baska' },
    { ...reply, app: undefined },
    { ...reply, publicKey: undefined },
    { ...reply, signature: undefined },
    { ...reply, publicKey: 123 },
    { ...reply, signature: 123 },
    { ...reply, publicKey: { a: 1 } },
    { ...reply, signature: ['x'] },
    { ...reply, fingerprint: 5 },
    { ...reply, publicKey: '!!!not base64!!!' },
    { ...reply, publicKey: '' },
    { ...reply, signature: '' },
    { ...reply, publicKey: rsa, fingerprint: undefined },
    { ...reply, publicKey: 'A'.repeat(201) },
    { ...reply, signature: 'A'.repeat(201) },
    { ...reply, publicKey: 'A'.repeat(5_000_000) },
  ];
  for (const bad of cases) {
    let result;
    assert.doesNotThrow(() => {
      result = verifyIdentityReply(bad, nonce);
    });
    assert.deepEqual(result, { ok: false });
  }
});

test('rejects bad nonce arguments without throwing', () => {
  const nonce = makeNonce();
  const { reply } = realReply(nonce);
  for (const bad of [undefined, null, 5, {}, '', 'abc']) {
    let result;
    assert.doesNotThrow(() => {
      result = verifyIdentityReply(reply, bad);
    });
    assert.deepEqual(result, { ok: false });
  }
});

test('makeNonce gives 64 lowercase hex and is different each time', () => {
  const a = makeNonce();
  const b = makeNonce();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.match(b, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('rejects a genuine EC P-256 key and signature (key-type check, under the length caps)', () => {
  const nonce = makeNonce();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const signature = crypto.sign(null, Buffer.from(IDENTITY_PREFIX + nonce), privateKey).toString('base64');
  // Önkoşul: alanlar 200 sınırının altında ve imza gerçekten geçerli; yalnızca anahtar türü denetimi reddedebilir.
  assert.ok(publicKeyB64.length <= 200 && signature.length <= 200);
  assert.equal(
    crypto.verify(null, Buffer.from(IDENTITY_PREFIX + nonce), publicKey, Buffer.from(signature, 'base64')),
    true
  );
  const reply = { app: 'ipchat', publicKey: publicKeyB64, signature };
  assert.deepEqual(verifyIdentityReply(reply, nonce), { ok: false });
  assert.deepEqual(verifyIdentityReply({ ...reply, fingerprint: fingerprintOf(publicKeyB64) }, nonce), { ok: false });
});

test('fingerprintOf never throws on bad input', () => {
  for (const bad of [undefined, null, 123, {}, [], Symbol('x'), 'x'.repeat(5_000_000)]) {
    let result;
    assert.doesNotThrow(() => {
      result = fingerprintOf(bad);
    });
    assert.equal(typeof result, 'string');
  }
  for (const bad of [undefined, null, 123, {}, [], Symbol('x')]) {
    assert.equal(fingerprintOf(bad), '');
  }
});
