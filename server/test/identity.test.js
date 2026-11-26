import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadOrCreateIdentity,
  IdentityError,
  IDENTITY_PREFIX,
  IDENTITY_EXIT_CODE,
  KEY_FILE,
  PUB_FILE,
} from '../src/identity.js';

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

test('identity exit code is the documented 78', () => {
  assert.equal(IDENTITY_EXIT_CODE, 78);
});

// Sunucu süreci kimlik okunamayınca ayrı bir çıkış koduyla durur: masaüstü bunu "port meşgul"den ayırır.
function runServer(dataDir) {
  const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, PORT: '0', IPCHAT_DATA_DIR: dataDir, IPCHAT_DB_PATH: '' },
      stdio: 'ignore',
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve('timeout');
    }, 8000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

test('server process exits with IDENTITY_EXIT_CODE when only the pub file exists', async () => {
  const dir = tmpDir();
  const source = tmpDir();
  loadOrCreateIdentity(source);
  fs.copyFileSync(path.join(source, PUB_FILE), path.join(dir, PUB_FILE));
  assert.equal(await runServer(dir), IDENTITY_EXIT_CODE);
  assert.equal(fs.existsSync(path.join(dir, KEY_FILE)), false, 'yeni anahtar uretilmemeli');
});

test('server process exits with IDENTITY_EXIT_CODE when the key file is corrupt', async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, KEY_FILE), 'bozuk');
  assert.equal(await runServer(dir), IDENTITY_EXIT_CODE);
  assert.equal(fs.readFileSync(path.join(dir, KEY_FILE), 'utf8'), 'bozuk');
});
