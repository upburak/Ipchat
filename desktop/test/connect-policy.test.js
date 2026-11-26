import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectAction,
  confirmAction,
  ownServerAction,
  isResultCurrent,
  shouldReconnect,
  isIdentityFailure,
  hostFailureMessage,
  shouldShowIdentityNotice,
  IDENTITY_FAILURE_LINE,
} from '../src/connect-policy.js';
import { IDENTITY_EXIT_CODE } from '../src/identity.js';
import { shortFingerprint } from '../src/identity.js';

const ID_A = { publicKey: 'QUJD', fingerprint: 'a1b2c3d4e5f6' + '0'.repeat(52) };
const ID_B = { publicKey: 'REVG', fingerprint: 'ffeeddccbbaa' + '1'.repeat(52) };
const SHORT_A = shortFingerprint(ID_A.fingerprint);
const SHORT_B = shortFingerprint(ID_B.fingerprint);

test('connectAction opens for known and new with the identity', () => {
  assert.deepEqual(connectAction({ state: 'known', identity: ID_A }), { action: 'open', identity: ID_A });
  assert.deepEqual(connectAction({ state: 'new', identity: ID_A }), { action: 'open', identity: ID_A });
});

test('connectAction opens for unsupported without an identity key', () => {
  const r = connectAction({ state: 'unsupported' });
  assert.deepEqual(r, { action: 'open' });
  assert.equal('identity' in r, false);
});

test('connectAction asks for confirmation when changed, with the short fingerprint', () => {
  assert.deepEqual(connectAction({ state: 'changed', identity: ID_B }), {
    action: 'confirm',
    info: { fingerprint: SHORT_B, legacy: false },
  });
});

test('connectAction asks for confirmation for a legacy server with an empty fingerprint', () => {
  assert.deepEqual(connectAction({ state: 'changed', legacy: true }), {
    action: 'confirm',
    info: { fingerprint: '', legacy: true },
  });
});

test('connectAction returns the Turkish errors for invalid and unreachable', () => {
  assert.deepEqual(connectAction({ state: 'invalid' }), {
    action: 'error',
    message: 'Bu sunucunun kimliği doğrulanamadı',
  });
  assert.deepEqual(connectAction({ state: 'unreachable' }), {
    action: 'error',
    message: 'Bu adreste Ipchat sunucusu bulunamadı',
  });
});

test('connectAction fails closed on unknown or malformed results', () => {
  for (const bad of [undefined, null, {}, { state: 'weird' }, { state: 'known' }, { state: 'new' }]) {
    assert.equal(connectAction(bad).action, 'error', JSON.stringify(bad));
  }
});

test('confirmAction opens when the identity still matches what the user saw', () => {
  assert.deepEqual(confirmAction({ state: 'changed', identity: ID_B }, SHORT_B), { action: 'open', identity: ID_B });
});

test('confirmAction errors when the identity differs from what the user saw (TOCTOU)', () => {
  assert.deepEqual(confirmAction({ state: 'changed', identity: ID_B }, SHORT_A), {
    action: 'error',
    message: 'Sunucu kimliği az önce değişti. Yeniden dene.',
  });
});

test('confirmAction opens with identity null for a legacy confirmation', () => {
  assert.deepEqual(confirmAction({ state: 'changed', legacy: true }, ''), { action: 'open', identity: null });
});

test('confirmAction errors when nothing was shown but the server now has an identity', () => {
  assert.equal(confirmAction({ state: 'changed', identity: ID_B }, '').action, 'error');
  assert.equal(confirmAction({ state: 'known', identity: ID_B }, '').action, 'error');
  assert.equal(confirmAction({ state: 'new', identity: ID_B }, '').action, 'error');
});

test('confirmAction errors when a fingerprint was shown but the server is now legacy', () => {
  assert.equal(confirmAction({ state: 'changed', legacy: true }, SHORT_A).action, 'error');
});

test('confirmAction errors when the server is no longer reachable or valid', () => {
  for (const state of ['unreachable', 'invalid', 'unsupported']) {
    assert.equal(confirmAction({ state }, SHORT_A).action, 'error', state);
    assert.equal(confirmAction({ state }, '').action, 'error', state);
  }
});

test('confirmAction errors on bad arguments', () => {
  assert.equal(confirmAction(undefined, SHORT_A).action, 'error');
  assert.equal(confirmAction({ state: 'changed', identity: ID_B }, undefined).action, 'error');
  assert.equal(confirmAction({ state: 'changed', identity: ID_B }, null).action, 'error');
});

test('ownServerAction opens only for known', () => {
  assert.deepEqual(ownServerAction({ state: 'known', identity: ID_A }), { action: 'open', identity: ID_A });
  for (const r of [
    { state: 'new', identity: ID_A },
    { state: 'changed', identity: ID_B },
    { state: 'changed', legacy: true },
    { state: 'unsupported' },
    { state: 'invalid' },
    { state: 'unreachable' },
    { state: 'known' },
    undefined,
    null,
  ]) {
    assert.deepEqual(ownServerAction(r), { action: 'fail' }, JSON.stringify(r));
  }
});

// Arka plan sonucu hâlâ geçerli mi (kullanıcı bu arada bağlantıyı değiştirmediyse)
test('isResultCurrent: nesil ayni ve pencere acik -> gecerli', () => {
  assert.equal(isResultCurrent({ startedGeneration: 3, currentGeneration: 3, alive: true }), true);
});

test('isResultCurrent: bu arada kullanici baglanti degistirdi (nesil artti) -> gecersiz', () => {
  assert.equal(isResultCurrent({ startedGeneration: 3, currentGeneration: 4, alive: true }), false);
});

test('isResultCurrent: pencere kapandi -> gecersiz', () => {
  assert.equal(isResultCurrent({ startedGeneration: 3, currentGeneration: 3, alive: false }), false);
});

test('isResultCurrent: baglanti sayfasi gerekiyorsa ve artik orada degilsek -> gecersiz', () => {
  assert.equal(
    isResultCurrent({ startedGeneration: 1, currentGeneration: 1, alive: true, needsConnectPage: true, onConnectPage: false }),
    false,
  );
  assert.equal(
    isResultCurrent({ startedGeneration: 1, currentGeneration: 1, alive: true, needsConnectPage: true, onConnectPage: true }),
    true,
  );
});

test('isResultCurrent: eksik/yanlis turde girdi guvenli yonde gecersiz', () => {
  assert.equal(isResultCurrent({}), false);
  assert.equal(isResultCurrent(undefined), false);
  assert.equal(isResultCurrent({ startedGeneration: '1', currentGeneration: 1, alive: true }), false);
  assert.equal(isResultCurrent({ startedGeneration: 1, currentGeneration: 1, alive: 1 }), false);
});

// Süren bağlanma bitince bekleyen yeniden bağlanma isteği çalıştırılsın mı
test('shouldReconnect: bekleyen istek, pencere acik, cikilmiyor -> calistir', () => {
  assert.equal(shouldReconnect({ pending: true, alive: true, quitting: false }), true);
});

test('shouldReconnect: bekleyen istek yoksa calistirma (sonsuz dongu yok)', () => {
  assert.equal(shouldReconnect({ pending: false, alive: true, quitting: false }), false);
});

test('shouldReconnect: pencere kapali ya da uygulama kapaniyorsa calistirma', () => {
  assert.equal(shouldReconnect({ pending: true, alive: false, quitting: false }), false);
  assert.equal(shouldReconnect({ pending: true, alive: true, quitting: true }), false);
});

test('shouldReconnect: eksik/yanlis turde girdi -> calistirma', () => {
  assert.equal(shouldReconnect(undefined), false);
  assert.equal(shouldReconnect({ pending: 1, alive: true, quitting: false }), false);
  assert.equal(shouldReconnect({ pending: true, alive: true }), false);
});

const identityError = () => Object.assign(new Error('Sunucu başlatılamadı'), { exitCode: IDENTITY_EXIT_CODE });

test('isIdentityFailure is true only for the identity exit code', () => {
  assert.equal(isIdentityFailure(identityError()), true);
  assert.equal(isIdentityFailure(Object.assign(new Error('x'), { exitCode: 1 })), false);
  assert.equal(isIdentityFailure(new Error('zaman asimi')), false);
  assert.equal(isIdentityFailure(undefined), false);
  assert.equal(isIdentityFailure({ exitCode: '78' }), false);
});

test('hostFailureMessage: identity failure points to the dialog, never mentions the port', () => {
  const line = hostFailureMessage(identityError(), 3000);
  assert.equal(line, IDENTITY_FAILURE_LINE);
  assert.match(line, /kimlik dosyası okunamadı/);
  assert.match(line, /açılan pencere/);
  assert.doesNotMatch(line, /port/);
});

test('hostFailureMessage: other failures keep the port message', () => {
  assert.match(hostFailureMessage(new Error('Sunucu başlatılamadı'), 3000), /3000 portu başka bir programda/);
  assert.match(hostFailureMessage(Object.assign(new Error('x'), { exitCode: 1 }), 3000), /3000 portu/);
});

test('shouldShowIdentityNotice: never for other failures', () => {
  for (const userInitiated of [true, false]) {
    assert.equal(
      shouldShowIdentityNotice({ error: new Error('x'), userInitiated, shownThisEpisode: false, open: false }),
      false
    );
  }
});

test('shouldShowIdentityNotice: never while the notice is already open', () => {
  assert.equal(shouldShowIdentityNotice({ error: identityError(), userInitiated: true, shownThisEpisode: false, open: true }), false);
  assert.equal(shouldShowIdentityNotice({ error: identityError(), userInitiated: false, shownThisEpisode: false, open: true }), false);
});

test('shouldShowIdentityNotice: automatic attempts show it once per failure episode', () => {
  assert.equal(shouldShowIdentityNotice({ error: identityError(), userInitiated: false, shownThisEpisode: false, open: false }), true);
  assert.equal(shouldShowIdentityNotice({ error: identityError(), userInitiated: false, shownThisEpisode: true, open: false }), false);
});

test('shouldShowIdentityNotice: a user click always gets an explanation', () => {
  assert.equal(shouldShowIdentityNotice({ error: identityError(), userInitiated: true, shownThisEpisode: true, open: false }), true);
});

test('shouldShowIdentityNotice: missing state is treated safely', () => {
  assert.equal(shouldShowIdentityNotice(undefined), false);
  assert.equal(shouldShowIdentityNotice({ error: identityError() }), true);
});
