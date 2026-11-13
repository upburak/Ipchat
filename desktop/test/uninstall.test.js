import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appBundlePath } from '../src/uninstall.js';

test('appBundlePath finds the .app bundle from the executable', () => {
  assert.equal(appBundlePath('/Applications/Ipchat.app/Contents/MacOS/Ipchat'), '/Applications/Ipchat.app');
  assert.equal(appBundlePath('/Users/x/Downloads/Ipchat.app/Contents/MacOS/Ipchat'), '/Users/x/Downloads/Ipchat.app');
});

test('appBundlePath returns null for non-mac paths', () => {
  assert.equal(appBundlePath('C:\\Program Files\\Ipchat\\Ipchat.exe'), null);
  assert.equal(appBundlePath('/usr/bin/electron'), null);
  assert.equal(appBundlePath(''), null);
});
