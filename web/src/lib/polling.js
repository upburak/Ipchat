export const POLL_MS = 3000;

export function mergeContacts(fetched, presence) {
  return fetched.map((c) => ({
    ...c,
    online: presence[c.id] !== undefined ? presence[c.id] : Boolean(c.online),
  }));
}

export function trackPending(seen, latest, first) {
  const nextSeen = new Set(seen);
  const fresh = [];
  for (const account of latest) {
    if (!nextSeen.has(account.id)) {
      nextSeen.add(account.id);
      if (!first) fresh.push(account);
    }
  }
  return { seen: nextSeen, fresh };
}

export function notificationText(fresh) {
  return {
    title: 'Yeni hesap isteği',
    body: fresh.length === 1 ? fresh[0].username : `${fresh.length} yeni hesap isteği`,
  };
}
