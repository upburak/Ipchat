import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLL_MS, mergeContacts, trackPending, notificationText } from '../src/lib/polling.js';

test('POLL_MS is 3000', () => {
  assert.equal(POLL_MS, 3000);
});

test('mergeContacts keeps live presence over the fetched flag', () => {
  const fetched = [{ id: 1, username: 'a', online: false }, { id: 2, username: 'b', online: true }];
  const merged = mergeContacts(fetched, { 1: true });
  assert.deepEqual(merged.map((c) => c.online), [true, true]);
});

test('mergeContacts defaults online to false', () => {
  assert.deepEqual(mergeContacts([{ id: 3, username: 'c' }], {}), [{ id: 3, username: 'c', online: false }]);
});

test('trackPending first read marks seen but notifies nothing', () => {
  const r = trackPending(new Set(), [{ id: 4, username: 'x' }, { id: 5, username: 'y' }], true);
  assert.deepEqual(r.fresh, []);
  assert.deepEqual([...r.seen].sort(), [4, 5]);
});

test('trackPending reports only unseen ids even when the count is unchanged', () => {
  const r = trackPending(new Set([1]), [{ id: 2, username: 'yeni' }], false);
  assert.deepEqual(r.fresh, [{ id: 2, username: 'yeni' }]);
  assert.deepEqual([...r.seen].sort(), [1, 2]);
});

test('trackPending does not repeat a notification for an already seen id', () => {
  const r = trackPending(new Set([2]), [{ id: 2, username: 'yeni' }], false);
  assert.deepEqual(r.fresh, []);
});

test('notificationText for one account', () => {
  assert.deepEqual(notificationText([{ id: 2, username: 'ayse' }]), { title: 'Yeni hesap isteği', body: 'ayse' });
});

test('notificationText for many accounts', () => {
  const fresh = [1, 2, 3].map((id) => ({ id, username: `u${id}` }));
  assert.deepEqual(notificationText(fresh), { title: 'Yeni hesap isteği', body: '3 yeni hesap isteği' });
});

import { startPoller } from '../src/lib/polling.js';

test('startPoller never overlaps slow ticks and stops cleanly', async () => {
  let running = 0;
  let maxRunning = 0;
  let calls = 0;
  const stop = startPoller(async () => {
    calls++;
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 40));
    running--;
  }, 10);
  await new Promise((r) => setTimeout(r, 150));
  stop();
  const after = calls;
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(maxRunning, 1);
  assert.equal(calls, after);
  assert.ok(calls >= 2);
});

test('startPoller tells a running task when it was stopped', async () => {
  let sawStopped = null;
  const stop = startPoller(async (isStopped) => {
    await new Promise((r) => setTimeout(r, 30));
    sawStopped = isStopped();
  }, 1000);
  await new Promise((r) => setTimeout(r, 5));
  stop();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(sawStopped, true);
});
