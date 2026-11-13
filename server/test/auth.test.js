import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');

beforeEach(() => {
  db.exec('DELETE FROM sessions; DELETE FROM devices; DELETE FROM users;');
});

test('first registered user is active admin with token', () => {
  const r = auth.register('ilk', 'sifre123');
  assert.equal(r.status, 'active');
  assert.ok(r.token);
  assert.equal(auth.verifySession(r.token).isAdmin, true);
});

test('second registered user is pending with no token', () => {
  auth.register('ilk', 'sifre123');
  const r = auth.register('ikinci', 'sifre123');
  assert.equal(r.status, 'pending');
  assert.equal(r.token, undefined);
});

test('pending user cannot log in with password or pin', () => {
  auth.register('ilk', 'sifre123');
  auth.register('ikinci', 'sifre123');
  assert.throws(() => auth.login('ikinci', 'sifre123'), /onay/);

  const active = auth.login('ilk', 'sifre123');
  const { deviceToken } = auth.setPin(active.userId, '1234');
  db.prepare("UPDATE users SET status = 'pending' WHERE username = 'ilk'").run();
  assert.throws(() => auth.loginWithPin(deviceToken, '1234'), /onay/);
});

test('rejected and disabled users get specific login errors', () => {
  auth.register('ilk', 'sifre123');
  auth.register('ikinci', 'sifre123');
  db.prepare("UPDATE users SET status = 'rejected' WHERE username = 'ikinci'").run();
  assert.throws(() => auth.login('ikinci', 'sifre123'), /reddedildi/);
  db.prepare("UPDATE users SET status = 'disabled' WHERE username = 'ikinci'").run();
  assert.throws(() => auth.login('ikinci', 'sifre123'), /kapatıldı/);
});

test('verifySession returns null for non-active users', () => {
  const first = auth.register('ilk', 'sifre123');
  assert.ok(auth.verifySession(first.token));
  db.prepare("UPDATE users SET status = 'disabled' WHERE username = 'ilk'").run();
  assert.equal(auth.verifySession(first.token), null);
});

test('rejected user can register again with the same username', () => {
  auth.register('ilk', 'sifre123');
  auth.register('ikinci', 'sifre123');
  db.prepare("UPDATE users SET status = 'rejected' WHERE username = 'ikinci'").run();
  const r = auth.register('ikinci', 'yenisifre1');
  assert.equal(r.status, 'pending');
  assert.throws(() => auth.login('ikinci', 'yenisifre1'), /onay/);
});
