import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_NOTICE, uninstallConfirm, purgeArgs, shouldShowInstallNotice, hasServerData } from '../src/cleanup.js';

test('kurulum metni iz birakmamayi ve sunucu istisnasini soyler', () => {
  const t = `${INSTALL_NOTICE.message} ${INSTALL_NOTICE.detail}`;
  assert.match(t, /iz bırakmaz/);
  assert.match(t, /otomatik başlatma/);
  assert.match(t, /güvenlik duvarı/);
  assert.match(t, /hesapları ve mesaj geçmişi silinmez/);
});

test('istemcide onay metni her seyin silinecegini ve geri alinamayacagini soyler', () => {
  const c = uninstallConfirm(false, '/x/server-data');
  assert.match(`${c.message} ${c.detail}`, /geri alınamaz/);
  assert.doesNotMatch(`${c.message} ${c.detail}`, /silinmedi|korun/);
});

test('sunucuda onay metni verinin korunacagini ve yolunu soyler', () => {
  const c = uninstallConfirm(true, '/Users/a/Library/Application Support/ipchat-desktop/server-data');
  const t = `${c.message} ${c.detail}`;
  assert.match(t, /silinmez|silinmedi|korun/);
  assert.ok(t.includes('/Users/a/Library/Application Support/ipchat-desktop/server-data'));
});

test('onay penceresinin varsayilani ve iptali her zaman Vazgec', () => {
  for (const has of [true, false]) {
    const c = uninstallConfirm(has, '/x');
    assert.deepEqual(c.buttons, ['Kaldır', 'Vazgeç']);
    assert.equal(c.defaultId, 1);
    assert.equal(c.cancelId, 1);
  }
});

test('istemcide silme komutu klasorun tamamini siler', () => {
  const a = purgeArgs('/Users/a/Library/Application Support/ipchat-desktop', false);
  assert.equal(a[0], '-c');
  assert.equal(a[a.length - 1], '/Users/a/Library/Application Support/ipchat-desktop');
  assert.doesNotMatch(a[1], /server-data/);
});

test('sunucuda silme komutu server-data disindakileri siler', () => {
  const a = purgeArgs('/x/ipchat-desktop', true);
  assert.match(a[1], /server-data/);
  assert.equal(a[a.length - 1], '/x/ipchat-desktop');
});

test('silme komutu yolu metne gommez, degisken olarak gecirir', () => {
  const dir = '/Users/a/Library/Application Support/ipchat-desktop';
  for (const keep of [true, false]) {
    const a = purgeArgs(dir, keep);
    assert.ok(!a[1].includes(dir), 'yol kabuk metnine gomulmemeli');
    assert.ok(a[1].includes('"$1"'), 'yol $1 olarak kullanilmali');
  }
});

test('bos server-data sunucu sayilmaz, NSIS ile ayni davranis', () => {
  assert.equal(hasServerData(['ipchat.db']), true);
  assert.equal(hasServerData([]), false);
  assert.equal(hasServerData(null), false);
});

test('ilk acilis bildirimi yalnizca bir kez gosterilir', () => {
  assert.equal(shouldShowInstallNotice({}), true);
  assert.equal(shouldShowInstallNotice({ installNoticeShown: false }), true);
  assert.equal(shouldShowInstallNotice({ installNoticeShown: true }), false);
});
