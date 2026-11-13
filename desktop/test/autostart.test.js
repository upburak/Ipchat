import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOSTART_NAME, loginItemSettings, loginItemQuery } from '../src/autostart.js';

test('autostart uses one explicit registry name', () => {
  assert.equal(AUTOSTART_NAME, 'Ipchat');
  assert.deepEqual(loginItemSettings(true), { openAtLogin: true, name: 'Ipchat' });
  assert.deepEqual(loginItemSettings(false), { openAtLogin: false, name: 'Ipchat' });
  assert.deepEqual(loginItemQuery(), { name: 'Ipchat' });
});
