import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { resetAdmin } = await import('../src/resetAdmin.js');

test('resetAdmin makes user an active admin with new password and clears sessions', () => {
  auth.register('ilk', 'sifre123');
  const second = auth.register('ikinci', 'sifre123');
  const old = auth.register('ucuncu', 'sifre123');
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(second.userId);
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run('eski-token', second.userId);

  resetAdmin(db, 'ikinci', 'yenisifre9');

  const row = db.prepare('SELECT status, is_admin FROM users WHERE id = ?').get(second.userId);
  assert.deepEqual({ ...row }, { status: 'active', is_admin: 1 });
  assert.equal(auth.verifySession('eski-token'), null);
  assert.equal(auth.login('ikinci', 'yenisifre9').userId, second.userId);
  assert.ok(old);
});

test('resetAdmin throws for unknown user', () => {
  assert.throws(() => resetAdmin(db, 'yok', 'sifre1234'), /bulunamadı/);
});
