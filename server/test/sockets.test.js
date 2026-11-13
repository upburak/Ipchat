import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { attachSockets } = await import('../src/sockets/index.js');
const { messagesRouter } = await import('../src/routes/messages.js');

const app = express();
app.use(express.json());
app.use('/api', messagesRouter);
const server = http.createServer(app);
const io = new Server(server);
attachSockets(io);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const clients = [];
after(() => {
  clients.forEach((c) => c.disconnect());
  io.close();
  server.close();
});

const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
async function open(token) {
  const s = connect(base, { auth: { token }, transports: ['websocket'] });
  clients.push(s);
  await new Promise((res, rej) => {
    s.on('connect', res);
    s.on('connect_error', rej);
  });
  return s;
}
const get = async (path, token) => {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

let a, b, c, pending;
beforeEach(() => {
  db.exec('DELETE FROM messages; DELETE FROM group_members; DELETE FROM groups; DELETE FROM sessions; DELETE FROM devices; DELETE FROM users;');
  auth.register('a', 'sifre123');
  auth.register('b', 'sifre123');
  auth.register('c', 'sifre123');
  auth.register('p', 'sifre123');
  db.prepare("UPDATE users SET status = 'active' WHERE username IN ('b','c')").run();
  a = auth.login('a', 'sifre123');
  b = auth.login('b', 'sifre123');
  c = auth.login('c', 'sifre123');
  pending = db.prepare("SELECT id FROM users WHERE username = 'p'").get().id;
});

test('group:create with unknown member id returns an error and does not crash', async () => {
  const s = await open(a.token);
  const r = await emit(s, 'group:create', { name: 'x', memberUserIds: [424242] });
  assert.ok(r.error);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM groups').get().n, 0);
  const again = await emit(s, 'group:create', { name: 'ok', memberUserIds: [b.userId] });
  assert.ok(again.group);
});

test('group:create rejects pending members', async () => {
  const s = await open(a.token);
  const r = await emit(s, 'group:create', { name: 'x', memberUserIds: [pending] });
  assert.ok(r.error);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM groups').get().n, 0);
});

test('message:send rejects pending recipient, unknown group and non-member group', async () => {
  const s = await open(a.token);
  assert.ok((await emit(s, 'message:send', { recipientType: 'user', recipientId: pending, body: 'hi' })).error);
  assert.ok((await emit(s, 'message:send', { recipientType: 'group', recipientId: 777, body: 'hi' })).error);
  const { group } = await emit(s, 'group:create', { name: 'g', memberUserIds: [b.userId] });
  const sc = await open(c.token);
  assert.ok((await emit(sc, 'message:send', { recipientType: 'group', recipientId: group.id, body: 'hi' })).error);
  assert.ok((await emit(s, 'message:send', { recipientType: 'user', recipientId: b.userId, body: 'merhaba' })).message);
});

test('message:send without recipientId returns an error and does not crash', async () => {
  const s = await open(a.token);
  assert.ok((await emit(s, 'message:send', { recipientType: 'user', body: 'x' })).error);
});

test('group history is only readable by members', async () => {
  const s = await open(a.token);
  const { group } = await emit(s, 'group:create', { name: 'g', memberUserIds: [b.userId] });
  assert.equal((await get(`/api/messages?withGroup=${group.id}`, c.token)).status, 403);
  assert.equal((await get(`/api/messages?withGroup=${group.id}`, b.token)).status, 200);
});

test('GET /groups hides members that are not active', async () => {
  const s = await open(a.token);
  const { group } = await emit(s, 'group:create', { name: 'g', memberUserIds: [b.userId] });
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(b.userId);
  const r = await get('/api/groups', a.token);
  const members = r.body.find((g) => g.id === group.id).members.map((m) => m.username);
  assert.deepEqual(members, ['a']);
});
