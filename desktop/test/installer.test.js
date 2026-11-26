import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nsh = fs.readFileSync(new URL('../build/installer.nsh', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('installer script adds both firewall rules for all profiles', () => {
  assert.match(nsh, /add rule name="Ipchat"[^\n]*protocol=TCP[^\n]*localport=3000[^\n]*profile=any/);
  assert.match(nsh, /add rule name="Ipchat"[^\n]*protocol=UDP[^\n]*localport=41234[^\n]*profile=any/);
});

test('installer script removes firewall rules, kills the app and clears autostart on uninstall', () => {
  assert.match(nsh, /delete rule name="Ipchat"/);
  assert.match(nsh, /taskkill/);
  assert.match(nsh, /CurrentVersion\\Run/);
  assert.match(nsh, /ipchat-desktop/);
});

test('package.json nsis is per machine, one click, includes the script and keeps data by default', () => {
  assert.equal(pkg.build.nsis.perMachine, true);
  assert.equal(pkg.build.nsis.oneClick, true);
  assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});

const uninstall = nsh.slice(nsh.indexOf('!macro customUnInstall'));

test('uninstall cleanup of rules and autostart is skipped during in-place updates', () => {
  const guard = uninstall.indexOf('${IfNot} ${isUpdated}');
  assert.ok(guard > -1);
  assert.ok(guard < uninstall.indexOf('delete rule name="Ipchat"'));
  assert.ok(guard < uninstall.indexOf('DeleteRegValue'));
});

test('uninstall removes every autostart value name Electron may have used', () => {
  for (const name of ['"Ipchat"', '"electron.app.ipchat-desktop"', '"electron.app.Ipchat"', '"com.ipchat.desktop"', '"ipchat-desktop"']) {
    assert.ok(uninstall.includes(`Run" ${name}`), `Run ${name} silinmeli`);
  }
});

test('kaldirma veri icin soru sormaz', () => {
  assert.doesNotMatch(uninstall, /MB_YESNO/);
});

test('kurulum sonunda iz birakmama metni gosterilir, sessiz kurulumda gosterilmez', () => {
  const install = nsh.slice(nsh.indexOf('!macro customInstall'), nsh.indexOf('!macro customUnInstall'));
  assert.match(install, /iz bırakmaz/);
  assert.match(install, /\$\{IfNot\} \$\{Silent\}/);
});

test('istemcide tum veri klasoru silinir', () => {
  const client = uninstall.slice(uninstall.indexOf('ipchat_client:'), uninstall.indexOf('ipchat_done:'));
  assert.match(client, /RMDir \/r "\$APPDATA\\ipchat-desktop"/);
  assert.match(client, /verisi silindi\. Bu işlem geri alınamaz/);
});

test('veri bloku guncellemede atlanir: son isUpdated korumasi Rename ve son RMDir den once gelir', () => {
  const guard = uninstall.lastIndexOf('${IfNot} ${isUpdated}');
  assert.ok(guard > uninstall.indexOf('delete rule name="Ipchat"'), 'veri blogu kendi korumasina sahip olmali');
  assert.ok(guard < uninstall.indexOf('Rename "$APPDATA'));
  assert.ok(guard < uninstall.lastIndexOf('RMDir /r'));
});

test('sessiz kaldirmada da silinir: veri blogunda Silent yalnizca mesaji korur', () => {
  assert.doesNotMatch(uninstall, /AndIfNot\} \$\{Silent\}/);
  const data = uninstall.slice(uninstall.indexOf('SetShellVarContext current'));
  for (const m of data.matchAll(/RMDir \/r|Rename "/g)) {
    const before = data.slice(0, m.index);
    const opens = (before.match(/\$\{IfNot\} \$\{Silent\}/g) || []).length;
    const closes = (before.match(/\$\{EndIf\}/g) || []).length;
    // Silent korumasinin icinde (acik EndIf eksigi) silme yapilmamali
    assert.ok(opens <= closes, 'silme Silent korumasinin icinde olmamali');
  }
});

test('geri koyma basarisizsa veri kurtarilabilir kalir, bayrak her Rename den once temizlenir', () => {
  // geri koyan Rename'in hemen oncesinde ClearErrors olmali (ilk IfErrors bayragini birakmis olabilir)
  assert.match(uninstall, /ClearErrors\s*\n\s*Rename "\$APPDATA\\ipchat-server-data-tmp"/);
  // ilk Rename'den once de bayrak temizlenmis olmali
  const first = uninstall.indexOf('Rename "$APPDATA');
  assert.ok(uninstall.lastIndexOf('ClearErrors', first) > uninstall.indexOf('SetShellVarContext current'));
  assert.match(uninstall, /IfErrors ipchat_restore_failed/);
  assert.match(uninstall, /\n\s*ipchat_restore_failed:/);
  assert.match(uninstall, /ipchat-server-data-tmp klasöründe duruyor/);
});

test('sunucuda server-data tasinip geri konur, silme yalnizca tasima basarili olunca yapilir', () => {
  assert.match(uninstall, /Rename "\$APPDATA\\ipchat-desktop\\server-data"/);
  assert.match(uninstall, /IfErrors/);
  const rename = uninstall.indexOf('Rename "$APPDATA\\ipchat-desktop\\server-data"');
  const iferr = uninstall.indexOf('IfErrors', rename);
  const rmdir = uninstall.indexOf('RMDir /r', rename);
  assert.ok(rename > -1 && iferr > -1 && rmdir > -1);
  assert.ok(iferr < rmdir, 'IfErrors, RMDir den once gelmeli');
});

test('uygulama silme islemlerinden once kapatilir', () => {
  assert.ok(uninstall.indexOf('taskkill') < uninstall.indexOf('RMDir /r'));
});

test('kaldirma metinleri istemci ve sunucu icin ayri', () => {
  assert.match(uninstall, /Bu işlem geri alınamaz/);
  assert.match(uninstall, /server-data/);
  assert.match(uninstall, /silinmedi/);
});

test('istemcide silmeden sonra kalinti denetlenir; kalinti varsa "silindi" denmez', () => {
  const client = uninstall.slice(uninstall.indexOf('ipchat_client:'), uninstall.indexOf('ipchat_done:'));
  const rmdir = client.indexOf('RMDir /r');
  const check = client.indexOf('${FileExists} "$APPDATA\\ipchat-desktop\\*.*"');
  const warn = client.indexOf('silinemedi');
  const ok = client.indexOf('verisi silindi');
  assert.ok(rmdir > -1 && check > rmdir, 'kalinti denetimi RMDir den sonra gelmeli');
  assert.ok(warn > check && ok > warn, 'kalinti uyarisi denetimin icinde, "silindi" mesaji Else dalinda olmali');
  assert.match(client.slice(check, ok), /\$\{Else\}/);
  assert.match(client, /elle sil/);
});
