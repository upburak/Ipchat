export function applyState(state, next) {
  let changed = false;
  for (const key of Object.keys(next)) {
    const a = state[key];
    const b = next[key];
    const differs = Array.isArray(a) && Array.isArray(b) ? a.length !== b.length || a.some((v, i) => v !== b[i]) : a !== b;
    if (differs) {
      state[key] = b;
      changed = true;
    }
  }
  return changed;
}

export function alertCount(state) {
  return state.badge + state.unread;
}

export function tooltipLines(state) {
  const lines = [];
  if (state.badge > 0) lines.push(`${state.badge} bekleyen hesap`);
  if (state.unread > 0) lines.push(`${state.unread} okunmamış mesaj`);
  if (state.running) lines.push('Ipchat sunucusu çalışıyor', ...state.urls);
  if (state.running && state.warning) lines.push('Güvenlik duvarı kurum ilkesiyle yönetiliyor');
  return lines;
}
