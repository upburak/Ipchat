import { db } from './db.js';

export class AdminError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function listUsers() {
  return db
    .prepare('SELECT id, username, status, is_admin, created_at FROM users ORDER BY id')
    .all()
    .map((u) => ({
      id: u.id,
      username: u.username,
      status: u.status,
      isAdmin: u.is_admin === 1,
      createdAt: u.created_at,
    }));
}

export function revokeUser(userId, io) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM devices WHERE user_id = ?').run(userId);
  io?.in(`user:${userId}`).disconnectSockets(true);
}

function activeAdminCount() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND status = 'active'").get().n;
}

const TRANSITIONS = {
  approve: { from: ['pending'], to: 'active', revoke: false },
  reject: { from: ['pending'], to: 'rejected', revoke: true },
  disable: { from: ['active'], to: 'disabled', revoke: true },
  enable: { from: ['disabled'], to: 'active', revoke: false },
};

export function applyAction(actorId, targetId, action, io) {
  const target = db.prepare('SELECT id, status, is_admin FROM users WHERE id = ?').get(targetId);
  if (!target) throw new AdminError(404, 'Kullanıcı bulunamadı');

  const isLastAdmin = target.is_admin === 1 && target.status === 'active' && activeAdminCount() <= 1;

  if (action === 'promote') {
    if (target.status !== 'active') throw new AdminError(400, 'Yalnızca aktif hesap yönetici yapılabilir');
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(targetId);
    return;
  }
  if (action === 'demote') {
    if (target.is_admin !== 1) throw new AdminError(400, 'Kullanıcı zaten yönetici değil');
    if (isLastAdmin) throw new AdminError(400, 'Son yöneticinin yöneticiliği alınamaz');
    db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(targetId);
    return;
  }

  const t = TRANSITIONS[action];
  if (!t) throw new AdminError(400, 'Geçersiz işlem');
  if (!t.from.includes(target.status)) throw new AdminError(400, 'Bu işlem hesabın şu anki durumuna uygun değil');
  if (action === 'disable') {
    if (actorId === targetId) throw new AdminError(400, 'Kendi hesabını kapatamazsın');
    if (isLastAdmin) throw new AdminError(400, 'Son yönetici kapatılamaz');
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(t.to, targetId);
  if (t.revoke) revokeUser(targetId, io);
}
