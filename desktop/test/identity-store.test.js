import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPinned, withConnection, withoutServer, readLocalIdentity } from '../src/identity-store.js';
import { fingerprintOf } from '../src/identity.js';
import { loadOrCreateIdentity } from '../../server/src/identity.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-store-'));
const realIdentity = () => loadOrCreateIdentity(tmp());
const asPin = (id) => ({ publicKey: id.publicKey, fingerprint: id.fingerprint });

test('getPinned returns the stored identity when valid', () => {
  const id = realIdentity();
  const config = { serverIdentity: asPin(id) };
  assert.deepEqual(getPinned(config), asPin(id));
});

test('getPinned returns undefined when nothing is stored', () => {
  assert.equal(getPinned({}), undefined);
  assert.equal(getPinned({ serverIdentity: null }), undefined);
  assert.equal(getPinned(undefined), undefined);
  assert.equal(getPinned(null), undefined);
});

test('getPinned returns undefined for a damaged shape', () => {
  const id = realIdentity();
  for (const bad of [
    'x',
    42,
    [],
    {},
    { publicKey: id.publicKey },
    { fingerprint: id.fingerprint },
    { publicKey: 1, fingerprint: id.fingerprint },
    { publicKey: id.publicKey, fingerprint: 7 },
    { publicKey: '', fingerprint: '' },
  ]) {
    assert.equal(getPinned({ serverIdentity: bad }), undefined, JSON.stringify(bad));
  }
});

test('getPinned returns undefined when the fingerprint does not match the key', () => {
  const a = realIdentity();
  const b = realIdentity();
  assert.equal(getPinned({ serverIdentity: { publicKey: a.publicKey, fingerprint: b.fingerprint } }), undefined);
  assert.equal(fingerprintOf(a.publicKey), a.fingerprint);
});

test('withConnection pins the identity when an object is given', () => {
  const id = realIdentity();
  const next = withConnection({ x: 1, lastServer: 'http://old:3000' }, 'http://new:3000', asPin(id));
  assert.deepEqual(next, { x: 1, lastServer: 'http://new:3000', serverIdentity: asPin(id) });
});

test('withConnection replaces an existing pin', () => {
  const a = realIdentity();
  const b = realIdentity();
  const next = withConnection({ serverIdentity: asPin(a) }, 'http://h:3000', asPin(b));
  assert.deepEqual(next.serverIdentity, asPin(b));
});

test('withConnection clears the pin when null is given', () => {
  const id = realIdentity();
  const next = withConnection({ lastServer: 'http://o', serverIdentity: asPin(id) }, 'http://n', null);
  assert.equal(next.lastServer, 'http://n');
  assert.equal('serverIdentity' in next, false);
});

test('withConnection leaves the pin alone when identity is undefined', () => {
  const id = realIdentity();
  const next = withConnection({ lastServer: 'http://o', serverIdentity: asPin(id) }, 'http://n');
  assert.deepEqual(next, { lastServer: 'http://n', serverIdentity: asPin(id) });
  const bare = withConnection({}, 'http://n');
  assert.deepEqual(bare, { lastServer: 'http://n' });
});

test('withConnection does not mutate its input', () => {
  const id = realIdentity();
  const config = { lastServer: 'http://o', serverIdentity: asPin(id) };
  const snapshot = JSON.parse(JSON.stringify(config));
  withConnection(config, 'http://n', null);
  withConnection(config, 'http://n', asPin(realIdentity()));
  withConnection(config, 'http://n');
  assert.deepEqual(config, snapshot);
});

test('withoutServer drops lastServer and serverIdentity but keeps the rest', () => {
  const id = realIdentity();
  const config = { lastServer: 'http://o', serverIdentity: asPin(id), mode: 'client' };
  const next = withoutServer(config);
  assert.deepEqual(next, { mode: 'client' });
  assert.equal(config.lastServer, 'http://o');
});

test('readLocalIdentity reads a real identity.pub', () => {
  const dir = tmp();
  const id = loadOrCreateIdentity(dir);
  assert.deepEqual(readLocalIdentity(dir), { publicKey: id.publicKey, fingerprint: id.fingerprint });
});

test('readLocalIdentity returns null for a missing file or directory', () => {
  assert.equal(readLocalIdentity(tmp()), null);
  assert.equal(readLocalIdentity(path.join(tmp(), 'yok')), null);
});

test('readLocalIdentity returns null for garbage content', () => {
  for (const content of ['', '\n', 'çöp çöp', '!!!not-base64!!!', 'AAAA', 'A'.repeat(5000)]) {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'identity.pub'), content);
    assert.equal(readLocalIdentity(dir), null, JSON.stringify(content.slice(0, 20)));
  }
});

test('readLocalIdentity never throws on bad arguments', () => {
  assert.equal(readLocalIdentity(undefined), null);
  assert.equal(readLocalIdentity(null), null);
  assert.equal(readLocalIdentity(42), null);
});
