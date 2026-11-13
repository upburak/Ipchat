import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addReply, broadcastAddresses } from '../src/discovery-client.js';

const msg = (o) => Buffer.from(JSON.stringify(o));
const local = new Set(['192.168.1.5']);

test('same name and port from two different remote hosts stay separate entries', () => {
  const found = new Map();
  addReply(found, msg({ app: 'ipchat', port: 3000, name: 'okul' }), { address: '192.168.1.10' }, local);
  addReply(found, msg({ app: 'ipchat', port: 3000, name: 'okul' }), { address: '192.168.1.99' }, local);
  assert.equal(found.size, 2);
});

test('loopback and own LAN address of the same machine collapse into the loopback url', () => {
  const found = new Map();
  addReply(found, msg({ app: 'ipchat', port: 3000, name: 'pc' }), { address: '192.168.1.5' }, local);
  addReply(found, msg({ app: 'ipchat', port: 3000, name: 'pc' }), { address: '127.0.0.1' }, local);
  assert.deepEqual([...found.values()], [{ url: 'http://127.0.0.1:3000', name: 'pc' }]);
});

test('truncates long names, rejects bad ports and caps the list at 20', () => {
  const found = new Map();
  addReply(found, msg({ app: 'ipchat', port: 3000, name: 'x'.repeat(5000) }), { address: '10.0.0.1' }, local);
  assert.equal([...found.values()][0].name.length, 64);
  addReply(found, msg({ app: 'ipchat', port: 0, name: 'a' }), { address: '10.0.0.2' }, local);
  addReply(found, msg({ app: 'ipchat', port: 70000, name: 'a' }), { address: '10.0.0.3' }, local);
  assert.equal(found.size, 1);
  for (let i = 0; i < 40; i++) {
    addReply(found, msg({ app: 'ipchat', port: 3000, name: 'n' }), { address: `10.1.0.${i + 1}` }, local);
  }
  assert.equal(found.size, 20);
});

test('broadcastAddresses computes the directed broadcast of every external IPv4 interface', () => {
  const ifaces = {
    en0: [{ family: 'IPv4', internal: false, address: '192.168.1.5', netmask: '255.255.255.0' }],
    eth1: [{ family: 'IPv4', internal: false, address: '10.2.3.4', netmask: '255.255.0.0' }],
    lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
    v6: [{ family: 'IPv6', internal: false, address: 'fe80::1', netmask: 'ffff::' }],
  };
  assert.deepEqual(broadcastAddresses(ifaces).sort(), ['10.2.255.255', '192.168.1.255']);
});
