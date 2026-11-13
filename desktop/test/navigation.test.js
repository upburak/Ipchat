import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isTrustedSender, shouldAllowNavigation } from '../src/navigation.js';

const connect = 'file:///app/src/connect.html';

test('only the local connect page may use the server:submit bridge', () => {
  assert.equal(isTrustedSender('file:///app/src/connect.html?mode=manual', connect), true);
  assert.equal(isTrustedSender('http://192.168.1.10:3000/', connect), false);
  assert.equal(isTrustedSender('file:///etc/passwd', connect), false);
  assert.equal(isTrustedSender(undefined, connect), false);
});

test('navigation is limited to the server origin and the connect page', () => {
  const server = 'http://192.168.1.10:3000';
  assert.equal(shouldAllowNavigation('http://192.168.1.10:3000/x', server, connect), true);
  assert.equal(shouldAllowNavigation('file:///app/src/connect.html?mode=choose', server, connect), true);
  assert.equal(shouldAllowNavigation('http://evil.example/', server, connect), false);
  assert.equal(shouldAllowNavigation('http://192.168.1.10:3001/', server, connect), false);
  assert.equal(shouldAllowNavigation('http://192.168.1.10:3000/', null, connect), false);
  assert.equal(shouldAllowNavigation('not a url', server, connect), false);
});

test('app icon is at least 256x256 so electron-builder accepts it for Windows', () => {
  const png = fs.readFileSync(new URL('../assets/icon.png', import.meta.url));
  assert.equal(png.readUInt32BE(16) >= 256, true);
  assert.equal(png.readUInt32BE(20) >= 256, true);
});
