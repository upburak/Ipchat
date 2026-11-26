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
  assert.match(uninstall, /RMDir \/r "\$APPDATA\\ipchat-desktop"/);
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
