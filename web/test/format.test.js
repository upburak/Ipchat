import { test } from 'node:test';
import assert from 'node:assert/strict';
// Saklanan zaman UTC, gosterim yerel saat. Test anlamli olsun diye saat
// dilimi sabitlenir; format.js bicimlendiriciyi yuklenirken kurdugu icin
// TZ atamasi modul yuklenmeden once olmali, bu yuzden dinamik import.
process.env.TZ = 'Europe/Istanbul';
const { messageTime, dayKey, dayLabel, matchesSearch } = await import('../src/lib/format.js');

// SQLite datetime('now') UTC uretir, saat dilimi isareti yoktur.
const UTC = '2026-11-14 09:03:00';

test('messageTime dizeyi UTC sayar ve 24 saat bicimiyle yazar', () => {
  const beklenen = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date('2026-11-14T09:03:00Z'));
  assert.equal(messageTime(UTC), beklenen);
  assert.equal(messageTime(UTC), '12:03');
});

test('messageTime gecersiz girdide bos doner', () => {
  for (const v of [null, undefined, '', 'abc', {}, [], 42, '2026-13-45 99:99:99', '2026-02-30 10:00:00']) {
    assert.equal(messageTime(v), '');
  }
  for (const v of ['2026-13-45 99:99:99', '2026-02-30 10:00:00']) {
    assert.equal(dayKey(v), '');
    assert.equal(dayLabel(v), '');
  }
});

test('dayKey ayni gunun iki mesajinda esittir, ertesi gunde farklidir', () => {
  assert.equal(dayKey('2026-11-14 07:00:00'), dayKey('2026-11-14 15:00:00')); // yerelde 10:00 ve 18:00, ayni gun
  assert.notEqual(dayKey('2026-11-14 15:00:00'), dayKey('2026-11-14 22:00:00')); // yerelde 18:00 ve ertesi gun 01:00
  assert.equal(dayKey('abc'), '');
});

test('dayLabel bugun ve dun icin kelime, oncesi icin tarih yazar', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(dayLabel('2026-11-14 09:03:00', now), 'Bugün');
  assert.equal(dayLabel('2026-11-13 09:03:00', now), 'Dün');
  assert.equal(dayLabel('2026-11-12 09:03:00', now), '12 Kasım');
  // 13 Kasim 22:00 UTC = 14 Kasim 01:00 Istanbul, yani "Bugün"
  assert.equal(dayLabel('2026-11-13 22:00:00', now), 'Bugün');
});

test('dayLabel farkli yilda yili da yazar', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(dayLabel('2025-11-12 09:03:00', now), '12 Kasım 2025');
});

test('dayLabel gecersiz girdide bos doner', () => {
  assert.equal(dayLabel('abc'), '');
});

test('matchesSearch Turkce buyuk-kucuk harfi dogru esler', () => {
  assert.equal(matchesSearch('Işık', 'ışık'), true);
  assert.equal(matchesSearch('ışık', 'IŞIK'), true);
  assert.equal(matchesSearch('İnci', 'inci'), true);
  assert.equal(matchesSearch('Çağla', 'çağ'), true);
});

test('matchesSearch bos sorguda her seyi esler, eslesmeyende false doner', () => {
  assert.equal(matchesSearch('Ahmet', ''), true);
  assert.equal(matchesSearch('Ahmet', '   '), true);
  assert.equal(matchesSearch('Ahmet', 'zeynep'), false);
  assert.equal(matchesSearch('', 'a'), false);
});
