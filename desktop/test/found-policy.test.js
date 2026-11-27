import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideFound } from '../src/found-policy.js';

const URL_A = 'http://192.168.1.10:3000';
const URL_B = 'http://192.168.1.20:3000';
const auto = (url = URL_A) => ({ status: 'ok', url, name: 'SUNUCU', autoPicked: true });

test('not autoPicked -> open', () => {
  assert.equal(decideFound({ status: 'ok', url: URL_A }, { dismissedUrl: null, shownUrl: null }), 'open');
  assert.equal(decideFound({ status: 'ok', url: URL_A, autoPicked: 'true' }, {}), 'open');
  // Kayıtlı adres/known sonucu, bilgi ekranı için unutulan adresle aynı olsa bile bugünkü yol.
  assert.equal(decideFound({ status: 'ok', url: URL_A }, { dismissedUrl: URL_A, shownUrl: URL_A }), 'open');
});

test('autoPicked -> show', () => {
  assert.equal(decideFound(auto(), { dismissedUrl: null, shownUrl: null }), 'show');
  assert.equal(decideFound(auto(), {}), 'show');
  assert.equal(decideFound(auto()), 'show');
});

test('autoPicked and dismissed url -> skip', () => {
  assert.equal(decideFound(auto(), { dismissedUrl: URL_A, shownUrl: null }), 'skip');
});

test('autoPicked and already shown url -> skip', () => {
  assert.equal(decideFound(auto(), { dismissedUrl: null, shownUrl: URL_A }), 'skip');
});

test('a different autoPicked url than the dismissed/shown one -> show', () => {
  assert.equal(decideFound(auto(URL_B), { dismissedUrl: URL_A, shownUrl: null }), 'show');
  assert.equal(decideFound(auto(URL_B), { dismissedUrl: null, shownUrl: URL_A }), 'show');
  assert.equal(decideFound(auto(URL_B), { dismissedUrl: URL_A, shownUrl: URL_A }), 'show');
});

test('missing/odd input never throws and returns open', () => {
  for (const r of [undefined, null, 0, 'x', [], {}, { autoPicked: true }, { autoPicked: true, url: '' },
    { autoPicked: true, url: 42 }, { status: 'choose', autoPicked: true, url: URL_A }]) {
    assert.doesNotThrow(() => decideFound(r, null));
    assert.equal(decideFound(r, null), 'open', JSON.stringify(r));
  }
  assert.equal(decideFound(auto(), null), 'show');
  assert.equal(decideFound(auto(), 'x'), 'show');
});
