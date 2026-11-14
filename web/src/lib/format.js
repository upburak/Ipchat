// Saat, tarih ve arama yardimcilari. Saf mantik: DOM, React ve ag yok.
// Veritabani zamani (SQLite datetime('now')) UTC'dir ve saat dilimi isareti tasimaz;
// bu yuzden dize, UTC olarak acikca ayristirilir (yerel saat sanilmez).

const SQLITE_UTC = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const dayMonthFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const dayMonthYearFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric', month: 'long', year: 'numeric',
});

function parseUtc(createdAt) {
  if (typeof createdAt !== 'string') return null;
  const m = SQLITE_UTC.exec(createdAt);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // Date.UTC tasmayi sessizce ileri alir (2026-02-30 -> 2 Mart); gecersiz alan
  // icin geri okuma eslesmez, o zaman null.
  const roundTrip = [
    date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(),
  ];
  const parsed = [y, mo, d, h, mi, s];
  if (roundTrip.some((v, i) => v !== parsed[i])) return null;
  return date;
}

function localDayKey(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function messageTime(createdAt) {
  const date = parseUtc(createdAt);
  return date ? timeFormat.format(date) : '';
}

export function dayKey(createdAt) {
  const date = parseUtc(createdAt);
  return date ? localDayKey(date) : '';
}

export function dayLabel(createdAt, now = new Date()) {
  const date = parseUtc(createdAt);
  if (!date) return '';
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = localDayKey(date);
  if (key === today) return 'Bugün';
  if (key === yesterday) return 'Dün';
  return date.getFullYear() === now.getFullYear()
    ? dayMonthFormat.format(date)
    : dayMonthYearFormat.format(date);
}

export function matchesSearch(text, query) {
  const q = String(query ?? '').trim().toLocaleLowerCase('tr');
  if (!q) return true;
  return String(text ?? '').toLocaleLowerCase('tr').includes(q);
}
