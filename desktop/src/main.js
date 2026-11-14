import { app, BrowserWindow, Notification, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveServer, isReachable } from './resolve-server.js';
import { loadConfig, saveConfig } from './config.js';
import { normalizeServerUrl } from './normalize-url.js';
import { windowOptions, webPreferences } from './window-options.js';
import { isTrustedSender, isServerSender, shouldAllowNavigation } from './navigation.js';
import { createTray } from './tray.js';
import { readFirewallPolicy } from './firewall-policy.js';
import { appBundlePath, uninstallBlockedReason } from './uninstall.js';
import { loginItemSettings, loginItemQuery } from './autostart.js';
import { startServerProcess, lanUrls } from './server-host.js';
import { networkServerKnown, HOST_CONFIRM } from './server-guard.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const connectFileUrl = pathToFileURL(path.join(here, 'connect.html')).href;
const RETRY_INTERVAL_MS = 10_000;
const HOST_PORT = 3000;

let win = null;
let tray = null;
let quitting = false;
let serverUrl = null;
let onConnectPage = false;
let retried = false;
let connecting = false;
let serverHost = null;
let firewallWarned = false;
let serverKnown = false;

if (process.platform === 'win32') app.setAppUserModelId('com.ipchat.desktop');

const configDir = () => app.getPath('userData');
const alive = () => win && !win.isDestroyed();

function serverPaths() {
  const bundle = path.join(here, '..', 'bundle');
  if (fs.existsSync(path.join(bundle, 'server', 'src', 'index.js'))) {
    return { entry: path.join(bundle, 'server', 'src', 'index.js'), webDist: path.join(bundle, 'web-dist') };
  }
  const root = path.join(here, '..', '..');
  return { entry: path.join(root, 'server', 'src', 'index.js'), webDist: path.join(root, 'web', 'dist') };
}

function refreshCounts() {
  tray?.update({ badge: pendingCount, unread: unreadCount });
  const total = pendingCount + unreadCount;
  if (process.platform === 'darwin' && total !== lastTotal) app.dock?.setBadge(total > 0 ? String(total) : '');
  lastTotal = total;
}

function setBadge(count) {
  pendingCount = count;
  refreshCounts();
}

function setUnreadCount(count) {
  unreadCount = count;
  refreshCounts();
}

const validCount = (count) => (Number.isInteger(count) && count > 0 ? Math.min(count, 99) : 0);

function validOpenTarget(open) {
  if (!open || (open.type !== 'user' && open.type !== 'group') || !Number.isInteger(open.id)) return null;
  return { type: open.type, id: open.id };
}

const activeNotifications = new Set();
let pendingCount = 0;
let unreadCount = 0;
let lastTotal = 0;
const clip = (value, max = 120) => String(value ?? '').slice(0, max);

ipcMain.handle('app:notify', (event, payload) => {
  if (!isServerSender(event.senderFrame?.url, serverUrl)) return;
  const notification = new Notification({ title: clip(payload?.title), body: clip(payload?.body) });
  const open = validOpenTarget(payload?.open);
  activeNotifications.add(notification);
  notification.on('click', () => {
    showWindow();
    if (!alive()) return;
    if (open) win.webContents.send('ipchat:open-conversation', open);
    else win.webContents.send('ipchat:open-admin');
  });
  notification.on('close', () => activeNotifications.delete(notification));
  notification.on('click', () => activeNotifications.delete(notification));
  notification.show();
});

ipcMain.handle('app:badge', (event, count) => {
  if (!isServerSender(event.senderFrame?.url, serverUrl)) return;
  setBadge(validCount(count));
});

ipcMain.handle('app:unread', (event, count) => {
  if (!isServerSender(event.senderFrame?.url, serverUrl)) return;
  setUnreadCount(validCount(count));
});

function updateTray() {
  tray?.update({ running: Boolean(serverHost), urls: serverHost ? lanUrls(HOST_PORT) : [], networkServerKnown: serverKnown });
}

async function uninstallEverything() {
  if (process.platform === 'win32') {
    shell.openExternal('ms-settings:appsfeatures');
    return;
  }
  const bundle = appBundlePath(process.execPath);
  const blocked = uninstallBlockedReason({ platform: process.platform, isPackaged: app.isPackaged, bundle });
  if (blocked) {
    dialog.showMessageBox({ type: 'info', title: 'Ipchat', message: 'Bu işlem şu an kullanılamıyor.', detail: blocked });
    return;
  }
  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: 'question',
    title: 'Ipchat',
    message: 'Ipchat tamamen kaldırılsın mı?',
    detail:
      "Sunucu durdurulur, otomatik başlatma kaldırılır ve uygulama Çöp Kutusu'na taşınır." +
      (serverHost ? ' Bu bilgisayar sunucu olduğu için, geçmişi silersen tüm kullanıcıların hesapları ve mesajları da silinir.' : ''),
    buttons: ['Kaldır', 'Vazgeç'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: 'Sohbet geçmişi ve ayarlar da silinsin (geri alınamaz)',
    checkboxChecked: true,
  });
  if (response !== 0) return;
  quitting = true;
  await serverHost?.stop();
  serverHost = null;
  app.setLoginItemSettings(loginItemSettings(false));
  if (bundle) {
    try {
      await shell.trashItem(bundle);
    } catch {
      quitting = false;
      await dialog.showMessageBox({
        type: 'error',
        title: 'Ipchat',
        message: 'Uygulama Çöp Kutusu\'na taşınamadı.',
        detail: 'Hiçbir veri silinmedi. Uygulamayı Uygulamalar klasörüne taşıyıp tekrar dene.',
      });
      return;
    }
  }
  if (checkboxChecked) {
    spawn('/bin/sh', ['-c', 'sleep 2; rm -rf "$1"', 'sh', app.getPath('userData')], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
  app.exit(0);
}

async function checkFirewall() {
  const { restricted } = await readFirewallPolicy();
  tray?.update({ warning: restricted });
  if (restricted && !firewallWarned && alive()) {
    firewallWarned = true;
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Ipchat',
      message: 'Bu bilgisayarın güvenlik duvarı kurum tarafından yönetiliyor.',
      detail:
        'Başka cihazlar bu bilgisayardaki sunucuya bağlanamayabilir. Sunucuyu başka bir bilgisayarda çalıştırmayı dene; bu bilgisayar istemci olarak sorunsuz çalışır.',
    });
  }
}

async function hostServer() {
  if (serverHost) return;
  const { entry, webDist } = serverPaths();
  serverHost = await startServerProcess({
    execPath: process.execPath,
    entry,
    port: HOST_PORT,
    dataDir: path.join(configDir(), 'server-data'),
    webDist,
    onExit: () => {
      serverHost = null;
      updateTray();
    },
  });
  updateTray();
  checkFirewall();
}

async function enableServerMode() {
  await hostServer();
  saveConfig(configDir(), { ...loadConfig(configDir()), serverMode: true, lastServer: `http://127.0.0.1:${HOST_PORT}` });
  retried = false;
  openServer(`http://127.0.0.1:${HOST_PORT}`);
}

async function requestServerMode() {
  const { response } = await dialog.showMessageBox(alive() ? win : undefined, HOST_CONFIRM);
  if (response !== 0) return { cancelled: true };
  try {
    await enableServerMode();
    return { ok: true };
  } catch {
    return { error: `Sunucu başlatılamadı (${HOST_PORT} portu başka bir programda kullanılıyor olabilir)` };
  }
}

async function disableServerMode() {
  saveConfig(configDir(), { ...loadConfig(configDir()), serverMode: false, lastServer: undefined });
  await serverHost?.stop();
  serverHost = null;
  updateTray();
  retried = false;
  showWindow();
  connectToServer();
}

function showWindow() {
  if (!alive()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  retryInBackground();
}

function showConnectPage(mode, servers = []) {
  setBadge(0);
  setUnreadCount(0);
  const query = { mode };
  if (servers.length) query.servers = JSON.stringify(servers);
  serverUrl = null;
  onConnectPage = true;
  win.loadFile(path.join(here, 'connect.html'), { query }).catch(() => {});
}

function openServer(url) {
  setBadge(0);
  setUnreadCount(0);
  serverUrl = url;
  onConnectPage = false;
  win.loadURL(url).catch(() => {});
}

async function connectToServer() {
  if (connecting) return;
  connecting = true;
  try {
    if (loadConfig(configDir()).serverMode) {
      try {
        await hostServer();
        if (alive()) openServer(`http://127.0.0.1:${HOST_PORT}`);
        return;
      } catch {
        if (alive()) showConnectPage('manual');
        return;
      }
    }
    const result = await resolveServer({ configDir: configDir() });
    serverKnown = networkServerKnown(result);
    updateTray();
    if (!alive()) return;
    if (result.status === 'ok') openServer(result.url);
    else showConnectPage(result.status, result.servers);
  } catch {
    if (alive()) showConnectPage('manual');
  } finally {
    connecting = false;
  }
}

async function retryInBackground() {
  if (!onConnectPage || connecting || !alive()) return;
  connecting = true;
  try {
    const result = await resolveServer({ configDir: configDir() });
    serverKnown = networkServerKnown(result);
    updateTray();
    if (result.status === 'ok' && alive()) {
      retried = false;
      openServer(result.url);
    }
  } catch {
    /* sessizce gec, sayfa oldugu gibi kalir */
  } finally {
    connecting = false;
  }
}

function changeServer() {
  disableServerMode();
}

function createWindow() {
  win = new BrowserWindow({
    ...windowOptions(),
    icon: path.join(here, '..', 'assets', 'icon.png'),
    webPreferences: webPreferences(path.join(here, 'preload.cjs')),
  });
  win.once('ready-to-show', () => win.show());

  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });

  const wc = win.webContents;
  wc.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const guardNavigation = (event, url) => {
    if (shouldAllowNavigation(url, serverUrl, connectFileUrl)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  };
  wc.on('will-navigate', guardNavigation);
  wc.on('will-redirect', guardNavigation);

  wc.on('did-finish-load', () => {
    if (serverUrl && wc.getURL().startsWith(serverUrl)) retried = false;
  });

  wc.on('did-navigate', (_event, url, httpResponseCode) => {
    if (serverUrl && url.startsWith(serverUrl) && httpResponseCode >= 400) showConnectPage('manual');
  });

  wc.on('did-fail-load', async (_event, errorCode, _desc, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (!serverUrl) {
      win.show();
      return;
    }
    if (retried) return showConnectPage('manual');
    retried = true;
    await connectToServer();
  });

  connectToServer();
  setInterval(retryInBackground, RETRY_INTERVAL_MS).unref();
}

ipcMain.handle('server:submit', async (event, text) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  let url;
  try {
    url = normalizeServerUrl(text);
  } catch (err) {
    return { error: err.message };
  }
  if (!(await isReachable(url))) return { error: 'Bu adreste Ipchat sunucusu bulunamadı' };
  try {
    saveConfig(configDir(), { ...loadConfig(configDir()), lastServer: url });
  } catch {
    /* ayar yazilamasa da baglanmaya devam et */
  }
  retried = false;
  openServer(url);
  return { ok: true };
});

ipcMain.handle('server:host', async (event) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  return requestServerMode();
});

function start() {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('before-quit', () => {
    quitting = true;
    serverHost?.stop();
  });
  app.on('window-all-closed', () => {
    /* tepside yasamaya devam eder */
  });

  app.whenReady().then(() => {
    const config = loadConfig(configDir());
    if (app.isPackaged && !config.autostartInitialized) {
      app.setLoginItemSettings(loginItemSettings(true));
      saveConfig(configDir(), { ...config, autostartInitialized: true });
    }
    tray = createTray({
      showWindow,
      changeServer,
      uninstall: uninstallEverything,
      hostServer: () => requestServerMode().catch(() => {}),
      stopHosting: disableServerMode,
      quit: async () => {
        quitting = true;
        await serverHost?.stop();
        app.quit();
      },
      isAutoStart: () => app.getLoginItemSettings(loginItemQuery()).openAtLogin,
      setAutoStart: (value) => app.setLoginItemSettings(loginItemSettings(value)),
    });
    createWindow();
  });
}

if (app.requestSingleInstanceLock()) {
  start();
} else {
  app.exit(0);
}
