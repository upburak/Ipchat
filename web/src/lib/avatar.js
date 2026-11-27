// Koyu tema: soldurulmus, tek ton ailesi (mavi-camgobegi), harf rengi --avatar-fg ile >= 4.5:1.
export const PALETTE = ['#2c6a78', '#2f5f86', '#3b5f7a', '#2a7280', '#44607a', '#2e6b6b', '#3d6a8c', '#4a5f80'];

export function initial(name) {
  const first = String(name ?? '').trim().charAt(0);
  return first ? first.toLocaleUpperCase('tr') : '?';
}

export function avatarColor(name) {
  let hash = 0;
  for (const ch of String(name ?? '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
