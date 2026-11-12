import { db } from '../db.js';

export function joinExistingGroupRooms(socket) {
  const groups = db
    .prepare('SELECT group_id FROM group_members WHERE user_id = ?')
    .all(socket.userId);
  for (const { group_id } of groups) {
    socket.join(`group:${group_id}`);
  }
}

export function registerGroupHandlers(io, socket) {
  socket.on('group:create', (payload, ack) => {
    const { name, memberUserIds } = payload || {};
    if (!name || !Array.isArray(memberUserIds)) {
      return ack?.({ error: 'Grup adı ve üye listesi gerekli' });
    }

    const memberIds = [...new Set([...memberUserIds, socket.userId])];

    const info = db
      .prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)')
      .run(name.trim(), socket.userId);
    const groupId = info.lastInsertRowid;

    const insertMember = db.prepare(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)'
    );
    for (const userId of memberIds) insertMember.run(groupId, userId);

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
    const members = db
      .prepare(
        `SELECT u.id, u.username FROM group_members gm
         JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`
      )
      .all(groupId);

    for (const userId of memberIds) {
      io.in(`user:${userId}`).socketsJoin(`group:${groupId}`);
    }
    io.to(`group:${groupId}`).emit('group:created', { ...group, members });

    ack?.({ group: { ...group, members } });
  });
}
