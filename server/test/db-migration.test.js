import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../src/migrate.js';

function legacyDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    pin_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  for (const name of ['ali', 'veli', 'ayse']) {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(name, 'x');
  }
  return db;
}

test('migrates legacy users to active and promotes oldest to admin', () => {
  const db = legacyDb();
  migrate(db);
  const rows = db.prepare('SELECT id, status, is_admin FROM users ORDER BY id').all();
  assert.deepEqual(rows.map((r) => r.status), ['active', 'active', 'active']);
  assert.deepEqual(rows.map((r) => r.is_admin), [1, 0, 0]);
});

test('migrate is idempotent and keeps the existing admin', () => {
  const db = legacyDb();
  migrate(db);
  db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('veli');
  db.prepare('UPDATE users SET is_admin = 0 WHERE username = ?').run('ali');
  migrate(db);
  const admins = db.prepare('SELECT username FROM users WHERE is_admin = 1').all();
  assert.deepEqual(admins.map((a) => a.username), ['veli']);
});
