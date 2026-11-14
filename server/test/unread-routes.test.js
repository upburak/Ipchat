import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { unreadRouter } = await import('../src/routes/unread.js');
const { ensureUnreadBaseline } = await import('../src/unread.js');

const app = express();
app.use(express.json());
app.use('/api', unreadRouter);
const server = http.createServer(app).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const post = (path, token, body) => call('POST', path, token, body);

const send = (senderId, type, recipientId, body = 'merhaba') =>
  Number(
    db
      .prepare('INSERT INTO messages (sender_id, recipient_type, recipient_id, body) VALUES (?, ?, ?, ?)')
      .run(senderId, type, recipientId, body).lastInsertRowid
  );

let ali, veli, aliToken, gizliGrupId;
beforeEach(() => {
  db.exec('DELETE FROM read_state; DELETE FROM messages; DELETE FROM group_members; DELETE FROM groups; DELETE FROM sessions; DELETE FROM devices; DELETE FROM users; DELETE FROM meta;');
  const a = auth.register('ali', 'sifre123'); // ilk kullanici: active
  ali = a.userId;
  aliToken = a.token;
  veli = auth.register('veli', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(veli);
  gizliGrupId = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('gizli', veli).lastInsertRowid);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gizliGrupId, veli);
  ensureUnreadBaseline(db);
});

test('kimliksiz istek 401 doner', async () => {
  assert.equal((await call('GET', '/api/unread', 'gecersiz')).status, 401);
});

test('GET /api/unread okunmamis sayilarini doner', async () => {
  send(veli, 'user', ali);
  const r = await call('GET', '/api/unread', aliToken);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { [`user:${veli}`]: 1 });
});

test('POST /api/read noktayi temizler', async () => {
  send(veli, 'user', ali);
  assert.equal((await post('/api/read', aliToken, { type: 'user', id: veli })).status, 200);
  assert.deepEqual((await call('GET', '/api/unread', aliToken)).body, {});
});

test('POST /api/read uyesi olunmayan grup icin 403 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'group', id: gizliGrupId })).status, 403);
});

test('POST /api/read olmayan kisi icin 404 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'user', id: 9999 })).status, 404);
});

test('POST /api/read gecersiz tur icin 400 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'kanal', id: 1 })).status, 400);
});
