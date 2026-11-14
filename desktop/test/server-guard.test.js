import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkServerKnown, HOST_CONFIRM } from '../src/server-guard.js';

test('agda bulunan sunucu listesi varsa bilinir', () => {
  assert.equal(networkServerKnown({ status: 'choose', servers: [{ url: 'http://192.168.1.5:3000' }] }), true);
});

test('uzak bir sunucuya bagliysa bilinir', () => {
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://192.168.1.5:3000' }), true);
});

test('kendi bilgisayarindaki sunucu agda baska sunucu sayilmaz', () => {
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://127.0.0.1:3000' }), false);
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://localhost:3000' }), false);
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://[::1]:3000' }), false);
});

test('sunucu bulunamadiysa bilinmez', () => {
  assert.equal(networkServerKnown({ status: 'manual' }), false);
  assert.equal(networkServerKnown({ status: 'choose', servers: [] }), false);
  assert.equal(networkServerKnown(undefined), false);
});

test('gecersiz adres bilinen sunucu sayilmaz', () => {
  assert.equal(networkServerKnown({ status: 'ok', url: 'bozuk adres' }), false);
  assert.equal(networkServerKnown({ status: 'ok' }), false);
});

test('onay penceresinin varsayilani Vazgec', () => {
  assert.equal(HOST_CONFIRM.buttons[HOST_CONFIRM.defaultId], 'Vazgeç');
  assert.equal(HOST_CONFIRM.cancelId, HOST_CONFIRM.defaultId);
  assert.match(HOST_CONFIRM.message, /sunucu olacak/);
});
