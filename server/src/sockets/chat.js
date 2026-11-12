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

    const info = db
      .prepare(
        `INSERT INTO messages (sender_id, recipient_type, recipient_id, body, file_url, file_name, file_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(socket.userId, recipientType, recipientId, body ?? null, fileUrl ?? null, fileName ?? null, fileType ?? null);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);

    if (recipientType === 'user') {
      io.to(`user:${recipientId}`).emit('message:new', message);
      io.to(`user:${socket.userId}`).emit('message:new', message);
    } else {
      io.to(`group:${recipientId}`).emit('message:new', message);
    }

    ack?.({ message });
  });
}
