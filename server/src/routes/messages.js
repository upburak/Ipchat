import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
import { isOnline } from '../sockets/presence.js';

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get('/users', (req, res) => {
  const users = db
    .prepare("SELECT id, username FROM users WHERE id != ? AND status = 'active' ORDER BY username")
    .all(req.user.id);
  res.json(users.map((u) => ({ ...u, online: isOnline(u.id) })));
});

messagesRouter.get('/groups', (req, res) => {
  const groups = db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? ORDER BY g.created_at`
    )
    .all(req.user.id);

  const memberStmt = db.prepare(
    `SELECT u.id, u.username FROM group_members gm
     JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? AND u.status = 'active'`
  );
  res.json(groups.map((g) => ({ ...g, members: memberStmt.all(g.id) })));
});

messagesRouter.get('/messages', (req, res) => {
  const { withUser, withGroup, before, limit = 50 } = req.query;

  let rows;
  if (withGroup) {
    const member = db
      .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
      .get(withGroup, req.user.id);
    if (!member) return res.status(403).json({ error: 'Bu grubun üyesi değilsin' });
    rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE recipient_type = 'group' AND recipient_id = ?
           AND (? IS NULL OR id < ?)
         ORDER BY id DESC LIMIT ?`
      )
      .all(withGroup, before ?? null, before ?? null, Number(limit));
  } else if (withUser) {
    rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE recipient_type = 'user'
           AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
           AND (? IS NULL OR id < ?)
         ORDER BY id DESC LIMIT ?`
      )
      .all(req.user.id, withUser, withUser, req.user.id, before ?? null, before ?? null, Number(limit));
  } else {
    return res.status(400).json({ error: 'withUser veya withGroup gerekli' });
  }

  res.json(rows.reverse());
});
