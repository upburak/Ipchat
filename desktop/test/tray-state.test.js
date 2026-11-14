import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyState, alertCount, tooltipLines } from '../src/tray-state.js';

test('applyState reports no change for equal values and arrays', () => {
  const state = { running: true, urls: ['a', 'b'], badge: 2 };
  assert.equal(applyState(state, { running: true, urls: ['a', 'b'], badge: 2 }), false);
});

test('applyState reports and applies changes', () => {
  const state = { running: false, urls: [], badge: 0 };
  assert.equal(applyState(state, { badge: 3 }), true);
  assert.equal(state.badge, 3);
  assert.equal(applyState(state, { urls: ['x'] }), true);
  assert.deepEqual(state.urls, ['x']);
});

const base = { running: false, urls: [], badge: 0, unread: 0, warning: false };

test('alertCount bekleyen hesap ve okunmamis mesaji toplar', () => {
  assert.equal(alertCount({ ...base, badge: 2, unread: 3 }), 5);
  assert.equal(alertCount(base), 0);
});

test('tooltipLines ikisini ayri satirlarda yazar', () => {
  assert.deepEqual(tooltipLines({ ...base, badge: 2, unread: 3 }), ['2 bekleyen hesap', '3 okunmamış mesaj']);
});

test('tooltipLines sunucu calisirken adresleri de ekler', () => {
  assert.deepEqual(tooltipLines({ ...base, running: true, urls: ['http://192.168.1.5:3000'] }), [
    'Ipchat sunucusu çalışıyor',
    'http://192.168.1.5:3000',
  ]);
});

test('tooltipLines guvenlik duvari uyarisini yalnizca sunucu calisirken ekler', () => {
  assert.deepEqual(tooltipLines({ ...base, running: true, warning: true }), [
    'Ipchat sunucusu çalışıyor',
    'Güvenlik duvarı kurum ilkesiyle yönetiliyor',
  ]);
  assert.deepEqual(tooltipLines({ ...base, warning: true }), []);
});

test('tooltipLines sessizken bos dizi doner', () => {
  assert.deepEqual(tooltipLines(base), []);
});
