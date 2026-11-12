// userId -> Set<socketId>
const online = new Map();

export function markOnline(userId, socketId) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
  return online.get(userId).size === 1; // true if user just came online
}

export function markOffline(userId, socketId) {
  const sockets = online.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    online.delete(userId);
    return true; // true if user just went offline
  }
  return false;
}

export function isOnline(userId) {
  return online.has(userId);
}

export function onlineUserIds() {
  return [...online.keys()];
}
