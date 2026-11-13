export const PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444'];

export function initial(name) {
  const first = String(name ?? '').trim().charAt(0);
  return first ? first.toLocaleUpperCase('tr') : '?';
}

export function avatarColor(name) {
  let hash = 0;
  for (const ch of String(name ?? '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
