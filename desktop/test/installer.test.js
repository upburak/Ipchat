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

test('installer script asks before deleting data, defaults to yes and skips updates and silent runs', () => {
  assert.match(nsh, /MB_YESNO\|MB_DEFBUTTON1/);
  assert.match(nsh, /RMDir \/r "\$APPDATA\\ipchat-desktop"/);
  assert.match(nsh, /\$\{isUpdated\}/);
  assert.match(nsh, /\$\{Silent\}/);
});

test('package.json nsis is per machine, one click, includes the script and keeps data by default', () => {
  assert.equal(pkg.build.nsis.perMachine, true);
  assert.equal(pkg.build.nsis.oneClick, true);
  assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});
