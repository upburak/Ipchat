export function migrate(db) {
  const columns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);

  if (!columns.includes('status')) {
    db.exec(
      `ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
       CHECK (status IN ('active','pending','rejected','disabled'))`
    );
  }
  if (!columns.includes('is_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }

  const hasAdmin = db.prepare('SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1').get();
  if (!hasAdmin) {
    db.exec('UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users)');
  }
}
