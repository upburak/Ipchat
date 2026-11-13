import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveServer, isReachable } from './resolve-server.js';
import { loadConfig, saveConfig } from './config.js';
import { normalizeServerUrl } from './normalize-url.js';
import { windowOptions } from './window-options.js';
import { isTrustedSender, shouldAllowNavigation } from './navigation.js';
import { createTray } from './tray.js';
import { startServerProcess, lanUrls } from './server-host.js';

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

function updateTray() {
  tray?.update({ running: Boolean(serverHost), urls: serverHost ? lanUrls(HOST_PORT) : [] });
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
}

async function enableServerMode() {
  await hostServer();
  saveConfig(configDir(), { ...loadConfig(configDir()), serverMode: true, lastServer: `http://127.0.0.1:${HOST_PORT}` });
  retried = false;
  openServer(`http://127.0.0.1:${HOST_PORT}`);
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
  const query = { mode };
  if (servers.length) query.servers = JSON.stringify(servers);
  serverUrl = null;
  onConnectPage = true;
  win.loadFile(path.join(here, 'connect.html'), { query }).catch(() => {});
}

function openServer(url) {
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
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
  try {
    await enableServerMode();
    return { ok: true };
  } catch {
    return { error: `Sunucu başlatılamadı (${HOST_PORT} portu başka bir programda kullanılıyor olabilir)` };
  }
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
      app.setLoginItemSettings({ openAtLogin: true });
      saveConfig(configDir(), { ...config, autostartInitialized: true });
    }
    tray = createTray({
      showWindow,
      changeServer,
      hostServer: () => enableServerMode().catch(() => {}),
      stopHosting: disableServerMode,
      quit: async () => {
        quitting = true;
        await serverHost?.stop();
        app.quit();
      },
      isAutoStart: () => app.getLoginItemSettings().openAtLogin,
      setAutoStart: (value) => app.setLoginItemSettings({ openAtLogin: value }),
    });
    createWindow();
  });
}

if (app.requestSingleInstanceLock()) {
  start();
} else {
  app.exit(0);
}
