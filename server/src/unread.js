import { db } from './db.js';
import { BASELINE_KEY } from './unread-baseline.js';

export { ensureUnreadBaseline } from './unread-baseline.js';

export class UnreadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function baselineId() {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(BASELINE_KEY);
  return row ? Number(row.value) : 0;
}

export function unreadCounts(userId) {
  const baseline = baselineId();
  const counts = {};

  const people = db
    .prepare(
      `SELECT m.sender_id AS peer, COUNT(*) AS n
       FROM messages m
       LEFT JOIN read_state r
         ON r.user_id = ? AND r.kind = 'user' AND r.peer_id = m.sender_id
       WHERE m.recipient_type = 'user' AND m.recipient_id = ? AND m.sender_id != ?
         AND m.id > MAX(COALESCE(r.last_read_id, 0), ?)
       GROUP BY m.sender_id`
    )
    .all(userId, userId, userId, baseline);
  for (const row of people) counts[`user:${row.peer}`] = row.n;

  const groups = db
    .prepare(
      `SELECT m.recipient_id AS peer, COUNT(*) AS n
       FROM messages m
       JOIN group_members gm ON gm.group_id = m.recipient_id AND gm.user_id = ?
       LEFT JOIN read_state r
         ON r.user_id = ? AND r.kind = 'group' AND r.peer_id = m.recipient_id
       WHERE m.recipient_type = 'group' AND m.sender_id != ?
         AND m.id > MAX(COALESCE(r.last_read_id, 0), ?)
       GROUP BY m.recipient_id`
    )
    .all(userId, userId, userId, baseline);
  for (const row of groups) counts[`group:${row.peer}`] = row.n;

  return counts;
}

export function markRead(userId, type, id) {
  let latest;
  if (type === 'group') {
    const member = db
      .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
      .get(id, userId);
    if (!member) throw new UnreadError(403, 'Bu grubun üyesi değilsin');
    latest = db
      .prepare(
        `SELECT COALESCE(MAX(id), 0) AS m FROM messages WHERE recipient_type = 'group' AND recipient_id = ?`
      )
      .get(id).m;
  } else if (type === 'user') {
    const peer = db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(id);
    if (!peer) throw new UnreadError(404, 'Kişi bulunamadı');
    latest = db
      .prepare(
        `SELECT COALESCE(MAX(id), 0) AS m FROM messages
         WHERE recipient_type = 'user'
           AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`
      )
      .get(userId, id, id, userId).m;
  } else {
    throw new UnreadError(400, 'Geçersiz sohbet türü');
  }

  db.prepare(
    `INSERT INTO read_state (user_id, kind, peer_id, last_read_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, kind, peer_id)
     DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`
  ).run(userId, type, id, latest);
}
