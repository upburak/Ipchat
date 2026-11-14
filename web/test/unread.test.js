import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationKeyOf, bumpUnread, clearUnread, totalUnread, pageTitle,
  shouldNotify, shouldCoalesce, notificationFor, NOTIFY_COALESCE_MS,
} from '../src/lib/unread.js';

const fromVeli = { id: 7, sender_id: 2, recipient_type: 'user', recipient_id: 1 };
const benden = { id: 8, sender_id: 1, recipient_type: 'user', recipient_id: 2 };
const grup = { id: 9, sender_id: 2, recipient_type: 'group', recipient_id: 5 };

test('conversationKeyOf gelen kisi mesajinda gondereni kullanir', () => {
  assert.equal(conversationKeyOf(fromVeli, 1), 'user:2');
});

test('conversationKeyOf kendi gonderdigim mesajda aliciyi kullanir', () => {
  assert.equal(conversationKeyOf(benden, 1), 'user:2');
});

test('conversationKeyOf grup mesajinda grubu kullanir', () => {
  assert.equal(conversationKeyOf(grup, 1), 'group:5');
});

test('bumpUnread ve clearUnread yeni nesne doner', () => {
  const a = {};
  const b = bumpUnread(a, 'user:2');
  assert.deepEqual(a, {});
  assert.deepEqual(b, { 'user:2': 1 });
  assert.deepEqual(bumpUnread(b, 'user:2'), { 'user:2': 2 });
  assert.deepEqual(clearUnread(b, 'user:2'), {});
});

test('totalUnread ve pageTitle', () => {
  assert.equal(totalUnread({ 'user:2': 2, 'group:5': 1 }), 3);
  assert.equal(pageTitle(3), '(3) Ipchat');
  assert.equal(pageTitle(0), 'Ipchat');
});

test('kendi mesajim icin bildirim yok', () => {
  assert.equal(shouldNotify({ message: benden, myId: 1, activeKey: null, focused: false }), false);
});

test('acik ve odaktaki sohbet icin bildirim yok', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'user:2', focused: true }), false);
});

test('sohbet acik ama pencere arkadaysa bildirim var', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'user:2', focused: false }), true);
});

test('baska sohbet acikken pencere odakta olsa da bildirim var', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'group:5', focused: true }), true);
});

test('shouldCoalesce 5 sn icinde true, sonrasinda false', () => {
  assert.equal(NOTIFY_COALESCE_MS, 5000);
  assert.equal(shouldCoalesce(1000, 1000 + 4999), true);
  assert.equal(shouldCoalesce(1000, 1000 + 5000), false);
  assert.equal(shouldCoalesce(undefined, 1000), false);
});

test('notificationFor mesaj icerigini gostermez', () => {
  const n = notificationFor({ ...fromVeli, body: 'gizli sifre' }, 'veli', 1);
  assert.deepEqual(n, { title: 'veli', body: 'Yeni mesaj', open: { type: 'user', id: 2 } });
});
