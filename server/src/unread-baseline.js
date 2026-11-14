export const BASELINE_KEY = 'unread_baseline_id';

// Yükseltme: sistem ilk kez bu özellikle açıldığında eski mesajlar okunmuş sayılsın.
export function ensureUnreadBaseline(handle) {
  handle.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (handle.prepare('SELECT 1 FROM meta WHERE key = ?').get(BASELINE_KEY)) return;
  const hasMessages = handle
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'messages'")
    .get();
  const maxId = hasMessages ? handle.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM messages').get().m : 0;
  handle.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(BASELINE_KEY, String(maxId));
}
