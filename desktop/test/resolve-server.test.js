import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveServer } from '../src/resolve-server.js';
import { loadConfig, saveConfig } from '../src/config.js';
import { fingerprintOf, shortFingerprint } from '../src/identity.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-rs-'));
const A = { url: 'http://10.0.0.1:3000', name: 'a' };
const B = { url: 'http://10.0.0.2:3000', name: 'b' };

// Sahte kimlikler: gerçek Ed25519 anahtarı gerekmez, getPinned yalnızca parmak izi eşleşmesine bakar.
function makeIdentity(seed) {
  const publicKey = Buffer.from(`anahtar-${seed}`).toString('base64');
  return { publicKey, fingerprint: fingerprintOf(publicKey) };
}
const ID1 = makeIdentity(1);
const ID2 = makeIdentity(2);
const ID3 = makeIdentity(3);

// table: adres -> VerifyResult. Tabloda olmayan adres ulaşılamaz sayılır.
// Bir değer Error ise o adres için verify reddedilir (rejecting verify).
function deps({ servers = [], table = {} } = {}) {
  const calls = { discover: 0, verified: [], pinnedSeen: [] };
  return {
    calls,
    discover: async () => {
      calls.discover++;
      return servers;
    },
    verify: async (url, pinned) => {
      calls.verified.push(url);
      calls.pinnedSeen.push(pinned);
      const r = table[url];
      if (r instanceof Error) throw r;
      return r ?? { state: 'unreachable' };
    },
  };
}

test('uses remembered server when it is known (and does not run discovery)', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ table: { [A.url]: { state: 'known', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: A.url, identity: ID1 });
  assert.equal(d.calls.discover, 0);
  // Sabitlenmiş kimlik verify'a iletilir.
  assert.deepEqual(d.calls.pinnedSeen[0], { publicKey: ID1.publicKey, fingerprint: ID1.fingerprint });
});

test('a single newly discovered server (no pin) connects without a chooser, and resolveServer itself saves nothing', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000' });
  const d = deps({ servers: [B], table: { [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url, identity: ID1 });
  assert.equal(loadConfig(configDir).lastServer, 'http://10.9.9.9:3000');
  assert.equal(loadConfig(configDir).serverIdentity, undefined);
});

test('a single new server on first launch (no remembered address, no pin) -> ok with identity, nothing written', async () => {
  const configDir = tmp();
  const d = deps({ servers: [B], table: { [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url, identity: ID1 });
  assert.equal(fs.readdirSync(configDir).length, 0);
});

test('a single unsupported (old, identity-less) server -> ok without an identity key', async () => {
  const configDir = tmp();
  const d = deps({ servers: [B], table: { [B.url]: { state: 'unsupported' } } });
  const r = await resolveServer({ configDir, ...d });
  assert.deepEqual(r, { status: 'ok', url: B.url });
  assert.equal('identity' in r, false);
  assert.equal(fs.readdirSync(configDir).length, 0);
});

test('remembered address unreachable (e.g. DHCP change) and one new server discovered -> ok on the new address', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d = deps({ servers: [B], table: { [A.url]: { state: 'unreachable' }, [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url, identity: ID1 });
  assert.equal(loadConfig(configDir).lastServer, A.url);
});

test('a single unreachable or invalid candidate and nothing else -> manual', async () => {
  for (const state of ['unreachable', 'invalid']) {
    const d = deps({ servers: [A], table: { [A.url]: { state } } });
    assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'manual' }, state);
  }
});

test('one new server plus one invalid candidate -> ok for the new one (the dropped candidate does not force a chooser)', async () => {
  const d = deps({
    servers: [A, B],
    table: { [A.url]: { state: 'invalid' }, [B.url]: { state: 'new', identity: ID1 } },
  });
  assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'ok', url: B.url, identity: ID1 });
});

test('drops discovered servers that are unreachable or invalid', async () => {
  const C = { url: 'http://10.0.0.3:3000', name: 'c' };
  const D = { url: 'http://10.0.0.4:3000', name: 'd' };
  const d = deps({
    servers: [A, B, C, D],
    table: {
      [A.url]: { state: 'unreachable' },
      [B.url]: { state: 'new', identity: ID1 },
      [C.url]: { state: 'invalid' },
      [D.url]: { state: 'unsupported' },
    },
  });
  assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'choose', servers: [B, D] });
});

test('autoPickSingle:false and one new candidate -> choose with that server (tray "connect to another server")', async () => {
  const configDir = tmp();
  const d = deps({ servers: [B], table: { [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, autoPickSingle: false, ...d }), { status: 'choose', servers: [B] });
  assert.equal(fs.readdirSync(configDir).length, 0);
});

test('autoPickSingle:false and one unsupported candidate -> choose with that server', async () => {
  const d = deps({ servers: [B], table: { [B.url]: { state: 'unsupported' } } });
  assert.deepEqual(await resolveServer({ configDir: tmp(), autoPickSingle: false, ...d }), { status: 'choose', servers: [B] });
});

test('autoPickSingle:false and one new plus one invalid candidate -> choose with only the new one', async () => {
  const d = deps({ servers: [A, B], table: { [A.url]: { state: 'invalid' }, [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir: tmp(), autoPickSingle: false, ...d }), { status: 'choose', servers: [B] });
});

test('two candidates -> choose whatever autoPickSingle is', async () => {
  for (const autoPickSingle of [true, false, undefined]) {
    const d = deps({
      servers: [A, B],
      table: { [A.url]: { state: 'new', identity: ID1 }, [B.url]: { state: 'unsupported' } },
    });
    assert.deepEqual(await resolveServer({ configDir: tmp(), autoPickSingle, ...d }), { status: 'choose', servers: [A, B] });
  }
});

test('autoPickSingle:true is the same as omitting it (single new -> ok)', async () => {
  const d = deps({ servers: [B], table: { [B.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir: tmp(), autoPickSingle: true, ...d }), { status: 'ok', url: B.url, identity: ID1 });
});

test('autoPickSingle:false does not change the remembered-address branches', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d1 = deps({ table: { [A.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, autoPickSingle: false, ...d1 }), { status: 'ok', url: A.url, identity: ID1 });
  const d2 = deps({ table: { [A.url]: { state: 'unsupported' } } });
  assert.deepEqual(await resolveServer({ configDir, autoPickSingle: false, ...d2 }), { status: 'ok', url: A.url });
});

test('autoPickSingle:false does not change pin-present behaviour (known -> ok, single changed -> changed)', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000', serverIdentity: ID1 });
  const dk = deps({ servers: [B], table: { [B.url]: { state: 'known', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, autoPickSingle: false, ...dk }), { status: 'ok', url: B.url, identity: ID1 });
  const dc = deps({ servers: [B], table: { [B.url]: { state: 'changed', identity: ID2 } } });
  const r = await resolveServer({ configDir, autoPickSingle: false, ...dc });
  assert.equal(r.status, 'changed');
  assert.equal(r.url, B.url);
});

test('two new candidates -> choose (unchanged)', async () => {
  const d = deps({
    servers: [A, B],
    table: { [A.url]: { state: 'new', identity: ID1 }, [B.url]: { state: 'new', identity: ID2 } },
  });
  assert.deepEqual(await resolveServer({ configDir: tmp(), ...d }), { status: 'choose', servers: [A, B] });
});

test('returns choose for several unknown servers', async () => {
  const d = deps({
    servers: [A, B],
    table: { [A.url]: { state: 'new', identity: ID1 }, [B.url]: { state: 'unsupported' } },
  });
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

test('address reused by a different server: remembered address changed but the pinned identity is found elsewhere -> ok on the new address, no warning', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({
    servers: [A, B],
    table: {
      [A.url]: { state: 'changed', identity: ID2 },
      [B.url]: { state: 'known', identity: ID1 },
    },
  });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: B.url, identity: ID1 });
  assert.equal(d.calls.discover, 1);
});

test('remembered address changed and nothing else found -> changed with the discovered name', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ servers: [A], table: { [A.url]: { state: 'changed', identity: ID2 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), {
    status: 'changed',
    url: A.url,
    name: 'a',
    fingerprint: shortFingerprint(ID2.fingerprint),
    legacy: false,
  });
});

test('changed result falls back to the hostname when the address is not in the discovery list', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ servers: [], table: { [A.url]: { state: 'changed', identity: ID2 } } });
  const r = await resolveServer({ configDir, ...d });
  assert.equal(r.status, 'changed');
  assert.equal(r.url, A.url);
  assert.equal(r.name, '10.0.0.1');
});

test('pinned, one unknown server discovered -> changed', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000', serverIdentity: ID1 });
  const d = deps({ servers: [B], table: { [B.url]: { state: 'changed', identity: ID2 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), {
    status: 'changed',
    url: B.url,
    name: 'b',
    fingerprint: shortFingerprint(ID2.fingerprint),
    legacy: false,
  });
});

test('pinned, two unknown -> choose with unfamiliar flags', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: 'http://10.9.9.9:3000', serverIdentity: ID1 });
  const d = deps({
    servers: [A, B],
    table: { [A.url]: { state: 'changed', identity: ID2 }, [B.url]: { state: 'changed', identity: ID3 } },
  });
  assert.deepEqual(await resolveServer({ configDir, ...d }), {
    status: 'choose',
    servers: [
      { url: A.url, name: 'a', unfamiliar: true },
      { url: B.url, name: 'b', unfamiliar: true },
    ],
  });
});

test('pinned, remembered address changed plus a discovered unknown server -> choose including the remembered one', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({
    servers: [A, B],
    table: { [A.url]: { state: 'changed', identity: ID2 }, [B.url]: { state: 'changed', identity: ID3 } },
  });
  const r = await resolveServer({ configDir, ...d });
  assert.equal(r.status, 'choose');
  assert.deepEqual(
    r.servers.map((s) => [s.url, s.unfamiliar]),
    [
      [A.url, true],
      [B.url, true],
    ],
  );
});

test('legacy server with a pin -> changed with legacy true and empty fingerprint', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ servers: [A], table: { [A.url]: { state: 'changed', legacy: true } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), {
    status: 'changed',
    url: A.url,
    name: 'a',
    fingerprint: '',
    legacy: true,
  });
});

test('unpinned and unsupported server at the remembered address -> ok without identity', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d = deps({ table: { [A.url]: { state: 'unsupported' } } });
  const r = await resolveServer({ configDir, ...d });
  assert.deepEqual(r, { status: 'ok', url: A.url });
  assert.equal('identity' in r, false);
  assert.equal(d.calls.discover, 0);
});

test('unpinned and a new server at the remembered address -> ok with identity', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d = deps({ table: { [A.url]: { state: 'new', identity: ID1 } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'ok', url: A.url, identity: ID1 });
});

test('invalid reply at the remembered address is never connected', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ servers: [A], table: { [A.url]: { state: 'invalid' } } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'manual' });
  assert.equal(d.calls.discover, 1);
});

test('the remembered address is verified once, not again as a discovery candidate', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const d = deps({ servers: [A, B], table: { [A.url]: { state: 'changed', identity: ID2 } } });
  await resolveServer({ configDir, ...d });
  assert.equal(d.calls.verified.filter((u) => u === A.url).length, 1);
});

test('a rejecting verify counts as unreachable and does not throw', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url });
  const d = deps({ servers: [B], table: { [A.url]: new Error('patladi'), [B.url]: new Error('patladi') } });
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'manual' });
});

test('a rejecting discover does not throw', async () => {
  const configDir = tmp();
  const d = deps();
  d.discover = async () => {
    throw new Error('ag yok');
  };
  assert.deepEqual(await resolveServer({ configDir, ...d }), { status: 'manual' });
});

test('resolveServer never writes the config', async () => {
  const configDir = tmp();
  saveConfig(configDir, { lastServer: A.url, serverIdentity: ID1 });
  const before = fs.readdirSync(configDir).map((f) => [f, fs.readFileSync(path.join(configDir, f), 'utf8')]);
  const d = deps({ servers: [B], table: { [A.url]: { state: 'changed', identity: ID2 }, [B.url]: { state: 'known', identity: ID1 } } });
  await resolveServer({ configDir, ...d });
  const after = fs.readdirSync(configDir).map((f) => [f, fs.readFileSync(path.join(configDir, f), 'utf8')]);
  assert.deepEqual(after, before);
});
