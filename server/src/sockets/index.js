import { verifySession } from '../auth.js';
import { markOnline, markOffline } from './presence.js';
import { registerChatHandlers } from './chat.js';
import { registerGroupHandlers, joinExistingGroupRooms } from './groups.js';

export function attachSockets(io) {
  io.use((socket, next) => {
    const user = verifySession(socket.handshake.auth?.token);
    if (!user) return next(new Error('Yetkisiz'));
    socket.userId = user.id;
    socket.username = user.username;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    joinExistingGroupRooms(socket);

    const wentOnline = markOnline(socket.userId, socket.id);
    if (wentOnline) {
      io.emit('presence:update', { userId: socket.userId, online: true });
    }

    registerChatHandlers(io, socket);
    registerGroupHandlers(io, socket);

    socket.on('disconnect', () => {
      const wentOffline = markOffline(socket.userId, socket.id);
      if (wentOffline) {
        io.emit('presence:update', { userId: socket.userId, online: false });
      }
    });
  });
}
