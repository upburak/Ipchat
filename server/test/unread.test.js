import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { unreadCounts, markRead, UnreadError, ensureUnreadBaseline } = await import('../src/unread.js');

const send = (senderId, type, recipientId, body = 'merhaba') =>
  Number(
    db
      .prepare(
        `INSERT INTO messages (sender_id, recipient_type, recipient_id, body) VALUES (?, ?, ?, ?)`
      )
      .run(senderId, type, recipientId, body).lastInsertRowid
  );

let ali, veli;
beforeEach(() => {
  db.exec('DELETE FROM read_state; DELETE FROM messages; DELETE FROM group_members; DELETE FROM groups; DELETE FROM sessions; DELETE FROM devices; DELETE FROM users; DELETE FROM meta;');
  ali = auth.register('ali', 'sifre123').userId;       // ilk kullanıcı: active
  veli = auth.register('veli', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(veli);
  ensureUnreadBaseline(db);
});

test('veliden gelen iki mesaj ali icin okunmamis sayilir', () => {
  send(veli, 'user', ali);
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 2 });
});

test('kendi gonderdigim mesaj bana okunmamis sayilmaz', () => {
  send(ali, 'user', veli);
  assert.deepEqual(unreadCounts(ali), {});
});

test('markRead noktayi temizler, sonraki mesaj yeniden sayilir', () => {
  send(veli, 'user', ali);
  markRead(ali, 'user', veli);
  assert.deepEqual(unreadCounts(ali), {});
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('markRead grup icin o grubun sayisini temizler', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('ekip', ali).lastInsertRowid);
  for (const u of [ali, veli]) db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, u);
  send(veli, 'group', gid);
  assert.deepEqual(unreadCounts(ali), { [`group:${gid}`]: 1 });
  markRead(ali, 'group', gid);
  assert.deepEqual(unreadCounts(ali), {});
});

test('markRead last_read_id degerini geri almaz', () => {
  send(veli, 'user', ali);
  const son = send(veli, 'user', ali);
  markRead(ali, 'user', veli);
  const oku = () => db.prepare('SELECT last_read_id FROM read_state WHERE user_id = ?').get(ali).last_read_id;
  assert.equal(oku(), son);
  db.prepare('DELETE FROM messages WHERE id = ?').run(son);   // en son mesaj silinince hesaplanan nokta geriye duser
  markRead(ali, 'user', veli);
  assert.equal(oku(), son);
  assert.deepEqual(unreadCounts(ali), {});
});

test('bir konusmayi okumak digerinin sayisini bozmaz', () => {
  const uc = auth.register('ucuncu', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(uc);
  send(veli, 'user', ali);
  send(uc, 'user', ali);
  send(uc, 'user', ali);
  markRead(ali, 'user', veli);
  assert.deepEqual(unreadCounts(ali), { [`user:${uc}`]: 2 });
});

test('grup mesaji uyeler icin sayilir, gonderen icin sayilmaz', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('ekip', ali).lastInsertRowid);
  for (const u of [ali, veli]) db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, u);
  send(veli, 'group', gid);
  assert.deepEqual(unreadCounts(ali), { [`group:${gid}`]: 1 });
  assert.deepEqual(unreadCounts(veli), {});
});

test('uyesi olmadigim grubun mesaji bana sayilmaz', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('gizli', veli).lastInsertRowid);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, veli);
  const uc = auth.register('ucuncu', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(uc);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, uc);
  send(uc, 'group', gid);
  assert.deepEqual(unreadCounts(ali), {});
});

test('baseline oncesi eski mesajlar okunmus sayilir', () => {
  send(veli, 'user', ali);
  db.exec('DELETE FROM meta');
  ensureUnreadBaseline(db);          // yukseltme: o anki en buyuk id baseline olur
  assert.deepEqual(unreadCounts(ali), {});
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('ensureUnreadBaseline ikinci cagrida baseline degistirmez', () => {
  send(veli, 'user', ali);
  ensureUnreadBaseline(db);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('markRead uyesi olmadigim grup icin 403 atar', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('gizli', veli).lastInsertRowid);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, veli);
  assert.throws(() => markRead(ali, 'group', gid), (err) => err instanceof UnreadError && err.status === 403);
});

test('markRead olmayan kisi icin 404 atar', () => {
  assert.throws(() => markRead(ali, 'user', 9999), (err) => err instanceof UnreadError && err.status === 404);
});

test('markRead aktif olmayan kisi icin 404 atar', () => {
  const bekleyen = auth.register('bekleyen', 'sifre123').userId;
  assert.throws(() => markRead(ali, 'user', bekleyen), (err) => err instanceof UnreadError && err.status === 404);
});

test('markRead gecersiz tur icin 400 atar', () => {
  assert.throws(() => markRead(ali, 'kanal', 1), (err) => err instanceof UnreadError && err.status === 400);
});
