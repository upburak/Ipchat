import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../src/normalize-url.js';

test('adds http scheme and default port to a bare host', () => {
  assert.equal(normalizeServerUrl('192.168.1.10'), 'http://192.168.1.10:3000');
});

test('trims spaces and keeps an explicit port', () => {
  assert.equal(normalizeServerUrl(' host:8080 '), 'http://host:8080');
});

test('keeps an explicit http(s) url', () => {
  assert.equal(normalizeServerUrl('https://a.b'), 'https://a.b');
});

test('rejects empty input and non-http schemes', () => {
  for (const bad of ['', '   ', 'javascript:alert(1)', 'ftp://x', 'a b']) {
    assert.throws(() => normalizeServerUrl(bad), /Geçersiz sunucu adresi/, `girdi: ${JSON.stringify(bad)}`);
  }
});
