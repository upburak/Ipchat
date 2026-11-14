export const NOTIFY_COALESCE_MS = 5000;

export function conversationKeyOf(message, myId) {
  if (message.recipient_type === 'group') return `group:${message.recipient_id}`;
  const other = message.sender_id === myId ? message.recipient_id : message.sender_id;
  return `user:${other}`;
}

export function bumpUnread(counts, key) {
  return { ...counts, [key]: (counts[key] || 0) + 1 };
}

export function clearUnread(counts, key) {
  const next = { ...counts };
  delete next[key];
  return next;
}

export function totalUnread(counts) {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function pageTitle(total) {
  return total > 0 ? `(${total}) Ipchat` : 'Ipchat';
}

export function shouldNotify({ message, myId, activeKey, focused }) {
  if (message.sender_id === myId) return false;
  return !focused || activeKey !== conversationKeyOf(message, myId);
}

export function shouldCoalesce(lastShownAt, now, windowMs = NOTIFY_COALESCE_MS) {
  if (lastShownAt === undefined) return false;
  return now - lastShownAt < windowMs;
}

export function notificationFor(message, senderName, myId) {
  const [type, id] = conversationKeyOf(message, myId).split(':');
  return { title: senderName, body: 'Yeni mesaj', open: { type, id: Number(id) } };
}
