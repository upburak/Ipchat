import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { createAdminRouter } = await import('../src/routes/admin.js');
const { messagesRouter } = await import('../src/routes/messages.js');

const disconnected = [];
const io = { in: (room) => ({ disconnectSockets: () => disconnected.push(room) }) };

const app = express();
app.use(express.json());
app.use('/api', createAdminRouter(io));
app.use('/api', messagesRouter);
const server = http.createServer(app).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

async function call(method, path, token) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let admin;
let pendingId;
beforeEach(() => {
  db.exec('DELETE FROM sessions; DELETE FROM devices; DELETE FROM users;');
  disconnected.length = 0;
  admin = auth.register('yonetici', 'sifre123');
  pendingId = auth.register('bekleyen', 'sifre123').userId;
});

test('non-admin gets 403', async () => {
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(pendingId);
  const token = auth.login('bekleyen', 'sifre123').token;
  assert.equal((await call('GET', '/api/admin/users', token)).status, 403);
});

test('approve moves pending to active', async () => {
  const r = await call('POST', `/api/admin/users/${pendingId}/approve`, admin.token);
  assert.equal(r.status, 200);
  assert.equal(auth.login('bekleyen', 'sifre123').userId, pendingId);
});

test('disable deletes sessions and devices and disconnects sockets', async () => {
  await call('POST', `/api/admin/users/${pendingId}/approve`, admin.token);
  const u = auth.login('bekleyen', 'sifre123');
  auth.setPin(u.userId, '1234');
  const r = await call('POST', `/api/admin/users/${pendingId}/disable`, admin.token);
  assert.equal(r.status, 200);
  assert.equal(auth.verifySession(u.token), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM devices WHERE user_id = ?').get(pendingId).n, 0);
  assert.deepEqual(disconnected, [`user:${pendingId}`]);
});

test('unknown id returns 404', async () => {
  assert.equal((await call('POST', '/api/admin/users/9999/approve', admin.token)).status, 404);
});

test('admin cannot disable self', async () => {
  const r = await call('POST', `/api/admin/users/${admin.userId}/disable`, admin.token);
  assert.equal(r.status, 400);
});

test('cannot demote the last active admin', async () => {
  const r = await call('POST', `/api/admin/users/${admin.userId}/demote`, admin.token);
  assert.equal(r.status, 400);
});

test('can promote another admin and then demote the first', async () => {
  await call('POST', `/api/admin/users/${pendingId}/approve`, admin.token);
  assert.equal((await call('POST', `/api/admin/users/${pendingId}/promote`, admin.token)).status, 200);
  assert.equal((await call('POST', `/api/admin/users/${admin.userId}/demote`, admin.token)).status, 200);
});

test('/users excludes pending accounts', async () => {
  const r = await call('GET', '/api/users', admin.token);
  assert.deepEqual(r.body.map((u) => u.username), []);
});
