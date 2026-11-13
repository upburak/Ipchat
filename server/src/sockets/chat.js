import { db } from '../db.js';

export function registerChatHandlers(io, socket) {
  socket.on('message:send', (payload, ack) => {
    const { recipientType, recipientId, body, fileUrl, fileName, fileType } = payload || {};
    if (recipientType !== 'user' && recipientType !== 'group') {
      return ack?.({ error: 'Geçersiz alıcı türü' });
    }
    if (!body && !fileUrl) {
      return ack?.({ error: 'Boş mesaj gönderilemez' });
    }

    const rid = Number(recipientId);
    if (!Number.isInteger(rid)) return ack?.({ error: 'Geçersiz alıcı' });
    if (recipientType === 'user') {
      const target = db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(rid);
      if (!target) return ack?.({ error: 'Alıcı bulunamadı' });
    } else {
      const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(rid, socket.userId);
      if (!member) return ack?.({ error: 'Bu grubun üyesi değilsin' });
    }

    const info = db
      .prepare(
        `INSERT INTO messages (sender_id, recipient_type, recipient_id, body, file_url, file_name, file_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(socket.userId, recipientType, rid, body ?? null, fileUrl ?? null, fileName ?? null, fileType ?? null);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);

    if (recipientType === 'user') {
      io.to(`user:${rid}`).emit('message:new', message);
      io.to(`user:${socket.userId}`).emit('message:new', message);
    } else {
      io.to(`group:${rid}`).emit('message:new', message);
    }

    ack?.({ message });
  });
}
