import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveServer, isReachable } from './resolve-server.js';
import { loadConfig, saveConfig } from './config.js';
import { normalizeServerUrl } from './normalize-url.js';
import { windowOptions } from './window-options.js';
import { createTray } from './tray.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let win = null;
let tray = null;
let quitting = false;
let serverUrl = null;
let retried = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const configDir = () => app.getPath('userData');

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function showConnectPage(mode, servers = []) {
  const query = { mode };
  if (servers.length) query.servers = JSON.stringify(servers);
  serverUrl = null;
  win.loadFile(path.join(here, 'connect.html'), { query });
}

async function connectToServer() {
  const result = await resolveServer({ configDir: configDir() });
  if (result.status === 'ok') {
    serverUrl = result.url;
    win.loadURL(result.url);
  } else {
    showConnectPage(result.status, result.servers);
  }
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', async (_event, errorCode, _desc, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || !serverUrl) return;
    if (retried) return showConnectPage('manual');
    retried = true;
    const config = loadConfig(configDir());
    saveConfig(configDir(), { ...config, lastServer: undefined });
    await connectToServer();
  });

  connectToServer();
}

ipcMain.handle('server:submit', async (_event, text) => {
  let url;
  try {
    url = normalizeServerUrl(text);
  } catch (err) {
    return { error: err.message };
  }
  if (!(await isReachable(url))) return { error: 'Bu adreste Ipchat sunucusu bulunamadı' };
  saveConfig(configDir(), { ...loadConfig(configDir()), lastServer: url });
  retried = false;
  serverUrl = url;
  win.loadURL(url);
  return { ok: true };
});

function isAutoStart() {
  return app.getLoginItemSettings().openAtLogin;
}

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  const config = loadConfig(configDir());
  if (app.isPackaged && !config.autostartInitialized) {
    app.setLoginItemSettings({ openAtLogin: true });
    saveConfig(configDir(), { ...config, autostartInitialized: true });
  }
  createWindow();
  tray = createTray({
    showWindow,
    quit: () => {
      quitting = true;
      app.quit();
    },
    isAutoStart,
    setAutoStart: (value) => app.setLoginItemSettings({ openAtLogin: value }),
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  /* tepside yasamaya devam eder */
});
