import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadOrCreateIdentity, IdentityError, IDENTITY_PREFIX, KEY_FILE, PUB_FILE } from '../src/identity.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-kimlik-'));

const publicKeyObject = (b64) =>
  crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });

test('creates key and pub files on first run', () => {
  const dir = tmpDir();
  const id = loadOrCreateIdentity(dir);
  assert.ok(fs.existsSync(path.join(dir, KEY_FILE)));
  assert.ok(fs.existsSync(path.join(dir, PUB_FILE)));
  assert.equal(id.publicKey, fs.readFileSync(path.join(dir, PUB_FILE), 'utf8').trim());
  assert.match(id.fingerprint, /^[0-9a-f]{64}$/);
});

test('returns the same identity on the second run', () => {
  const dir = tmpDir();
  const a = loadOrCreateIdentity(dir);
  const b = loadOrCreateIdentity(dir);
  assert.equal(b.publicKey, a.publicKey);
  assert.equal(b.fingerprint, a.fingerprint);
});

test('signature verifies with node:crypto against the public key', () => {
  const id = loadOrCreateIdentity(tmpDir());
  const sig = id.sign('nonce-123');
  assert.equal(
    crypto.verify(null, Buffer.from(IDENTITY_PREFIX + 'nonce-123'), publicKeyObject(id.publicKey), Buffer.from(sig, 'base64')),
    true
  );
});

test('signature for one nonce does not verify for another', () => {
  const id = loadOrCreateIdentity(tmpDir());
  const sig = id.sign('nonce-1');
  assert.equal(
    crypto.verify(null, Buffer.from(IDENTITY_PREFIX + 'nonce-2'), publicKeyObject(id.publicKey), Buffer.from(sig, 'base64')),
    false
  );
});

test('rewrites a missing pub file from the key', () => {
  const dir = tmpDir();
  const a = loadOrCreateIdentity(dir);
  fs.rmSync(path.join(dir, PUB_FILE));
  const b = loadOrCreateIdentity(dir);
  assert.equal(b.publicKey, a.publicKey);
  assert.equal(b.fingerprint, a.fingerprint);
  assert.equal(fs.readFileSync(path.join(dir, PUB_FILE), 'utf8').trim(), a.publicKey);
});

test('throws IdentityError and touches nothing when the key file is corrupt', () => {
  const dir = tmpDir();
  const keyPath = path.join(dir, KEY_FILE);
  fs.writeFileSync(keyPath, 'çöp');
  assert.throws(() => loadOrCreateIdentity(dir), IdentityError);
  assert.equal(fs.readFileSync(keyPath, 'utf8'), 'çöp');
  assert.deepEqual(fs.readdirSync(dir), [KEY_FILE]);
});

test('throws IdentityError when only the pub file exists', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, PUB_FILE), 'AAAA\n');
  assert.throws(() => loadOrCreateIdentity(dir), IdentityError);
  assert.equal(fs.existsSync(path.join(dir, KEY_FILE)), false);
  assert.equal(fs.readFileSync(path.join(dir, PUB_FILE), 'utf8'), 'AAAA\n');
});
