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

export function startPoller(task, ms = POLL_MS) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await task(() => stopped);
    } catch {
      /* sonraki turda tekrar denenir */
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, ms);
  tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
