import { app, BrowserWindow, Notification, dialog, ipcMain, nativeTheme, shell } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveServer } from './resolve-server.js';
import { verifyServer } from './verify-server.js';
import { getPinned, withConnection, withoutServer, readLocalIdentity, identityFailureNotice } from './identity-store.js';
import {
  connectAction,
  confirmAction,
  ownServerAction,
  isResultCurrent,
  shouldReconnect,
  isIdentityFailure,
  hostFailureMessage,
  shouldShowIdentityNotice,
} from './connect-policy.js';
import { loadConfig, saveConfig } from './config.js';
import { normalizeServerUrl } from './normalize-url.js';
import { windowOptions, webPreferences } from './window-options.js';
import { isTrustedSender, isServerSender, shouldAllowNavigation } from './navigation.js';
import { createTray } from './tray.js';
import { readFirewallPolicy } from './firewall-policy.js';
import { appBundlePath, uninstallBlockedReason } from './uninstall.js';
import { loginItemSettings, loginItemQuery } from './autostart.js';
import { startServerProcess, lanUrls } from './server-host.js';
import { uninstallConfirm, purgeArgs, hasServerData, leftoverServerDataNotice, removalRule } from './cleanup.js';
import { needsWelcome, welcomeRecord } from './welcome.js';
import { decideFound } from './found-policy.js';
import { networkServerKnown, HOST_CONFIRM, CHANGE_SERVER_CONFIRM } from './server-guard.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const connectFileUrl = pathToFileURL(path.join(here, 'connect.html')).href;
const welcomeFileUrl = pathToFileURL(path.join(here, 'welcome.html')).href;
const RETRY_INTERVAL_MS = 10_000;
const HOST_PORT = 3000;
const LOCAL_URL = `http://127.0.0.1:${HOST_PORT}`;

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
let confirmingHost = false;
let confirmingChange = false;
let knownServers = [];
// Kullanıcının başlattığı her bağlantı değişikliğinde artar (submit/confirm/sunucu modu aç-kapa).
// connectToServer ve retryInBackground beklemeden önce bunu alır; sonra farklıysa sonucunu atar.
let connectGeneration = 0;
const stillCurrent = (startedGeneration, needsConnectPage = false) =>
  isResultCurrent({ startedGeneration, currentGeneration: connectGeneration, alive: Boolean(alive()), needsConnectPage, onConnectPage });
// Bir bağlanma sürerken gelen connectToServer isteği kaybolmasın: süren iş bitince bir kez çalışır.
let reconnectPending = false;
// Sabitleme yokken ağda tek sunucu bulunursa ona sorusuz bağlanılır (resolveServer autoPickSingle).
// Tepsiden "Başka bir sunucuya bağlan…" bunu false yapar: kullanıcı az önce ayrıldığı sunucuya geri
// atılmasın, tek girişli liste görsün. Kullanıcı bağlanınca (submit/confirm/sunucu modu) true olur;
// uygulama yeniden başlayınca da true'dur (modül durumu).
let autoPickSingle = true;
// "Sunucu bulundu" bilgi ekranı (tasarım 2026-11-27 §6.1; karar: found-policy.js decideFound).
// foundShownUrl: bilgi ekranı şu an bu adres için gösteriliyor (10 sn'lik deneme aynı ekranı yeniden
// kurup geri sayımı sıfırlamasın). showConnectPage başka bir modla çağrılınca ve openServer'da silinir.
// foundDismissedUrl: kullanıcı bu adres için "Başka bir adres yaz" dedi; oturum boyunca bu adres bilgi
// ekranıyla yeniden önerilmez. autoPickSingle'ın ayarlandığı yerlerde (kullanıcının başarılı bağlanışı:
// submit/confirm/kendi sunucusu; tepsideki "Başka bir sunucuya bağlan…" onayı) silinir.
let foundShownUrl = null;
let foundDismissedUrl = null;
// İlk açılış onayı bekleniyor (tasarım §7.4). Doğruyken yalnızca pencere ve welcome.html vardır:
// keşif/bağlanma, sunucu modu, otomatik başlatma kaydı, tepsi ve kalıntı uyarısı çalışmaz.
let welcomePending = false;
// Kendi sunucumuz kimlik dosyası okunamadığı için başlamadıysa yöneticiye açıklama gösterilir.
// identityNoticeShown: bu hata döneminde otomatik denemeler zaten gösterdi mi (sunucu başarıyla
// başlayınca sıfırlanır). identityNoticeOpen: pencere şu an açık mı (üst üste açılmasın).
let identityNoticeShown = false;
let identityNoticeOpen = false;

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
  // Sunucu verisi dosya sisteminden okunur (sunucu modu kapalıyken de veri durabilir); silmeden önce.
  const serverDataPath = path.join(configDir(), 'server-data');
  // Yalnızca ENOENT "sunucu yok" demektir; başka her hata emin olamamak demektir ve korunur.
  let entries = null;
  let errorCode;
  try {
    entries = fs.readdirSync(serverDataPath);
  } catch (err) {
    errorCode = err?.code ?? 'UNKNOWN';
  }
  const keepServerData = hasServerData(entries, errorCode);
  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Ipchat',
    ...uninstallConfirm(keepServerData, serverDataPath),
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
  spawn('/bin/sh', purgeArgs(app.getPath('userData'), keepServerData), {
    detached: true,
    stdio: 'ignore',
  }).unref();
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
  identityNoticeShown = false; // sunucu başladı: kimlik hatası dönemi bitti
  updateTray();
  checkFirewall();
}

// Kimlik hatasıysa (sunucu 78 koduyla çıktı) açıklama penceresini gösterir; beklemez.
// userInitiated: kullanıcının tıklaması (bağlantı sayfası düğmesi ya da tepsi). Gösterildiyse true.
function notifyIdentityFailure(err, userInitiated) {
  const show = shouldShowIdentityNotice({
    error: err,
    userInitiated,
    shownThisEpisode: identityNoticeShown,
    open: identityNoticeOpen,
  });
  if (!show) return false;
  identityNoticeShown = true;
  identityNoticeOpen = true;
  const notice = identityFailureNotice(path.join(configDir(), 'server-data'));
  // Pencere tepsiye gizliyken ona bagli pencere (sheet) macOS'ta hic gorunmeyebilir.
  const parent = alive() && win.isVisible() ? win : undefined;
  dialog
    .showMessageBox(parent, { type: 'error', title: 'Ipchat', message: notice.message, detail: notice.detail })
    .catch(() => {})
    .finally(() => {
      identityNoticeOpen = false;
    });
  return true;
}

// Bağlanılan sunucuyu (adres ve kimlik) kaydeder. identity: nesne = sabitle, null = sabitlemeyi sil,
// undefined = dokunma. Ayar yazılamasa da bağlanmaya devam edilir.
function rememberConnection(url, identity, extra = {}) {
  try {
    saveConfig(configDir(), { ...withConnection(loadConfig(configDir()), url, identity), ...extra });
  } catch {
    /* ayar yazilamasa da baglanmaya devam et */
  }
}

// Kendi sunucumuz (sunucu modu): alt süreci başlatır, kimliği server-data'daki identity.pub'dan
// okur ve 127.0.0.1 yanıtının bu kimlikle eşleşmesini ister (aynı portu başka bir süreç tutuyorsa
// eşleşmez, bağlanılmaz). Eşleşirse sorusuz hatırlanır. Başarıda true, aksi halde false döner.
// startedGeneration: otomatik çağrıda (connectToServer) verilir; bu arada kullanıcı bağlantıyı
// değiştirdiyse sonuç atılır. Kullanıcının kendi isteğinde (enableServerMode) verilmez.
async function openOwnServer(extra = {}, startedGeneration) {
  const hadHost = Boolean(serverHost);
  await hostServer();
  const startedHere = hadHost ? null : serverHost; // bu çağrının başlattığı alt süreç
  const own = readLocalIdentity(path.join(configDir(), 'server-data'));
  const action = own ? ownServerAction(await verifyServer(LOCAL_URL, own)) : { action: 'fail' };
  if (startedGeneration !== undefined && !stillCurrent(startedGeneration)) {
    // Sonuç atıldı. Bu arada sunucu modu kapatıldıysa (disableServerMode alt süreci henüz
    // yokken durduramadı) bu çağrının başlattığı sunucu sahipsiz kalmasın.
    if (startedHere && serverHost === startedHere && !loadConfig(configDir()).serverMode) {
      await startedHere.stop();
      if (serverHost === startedHere) serverHost = null;
      updateTray();
    }
    return false;
  }
  if (action.action !== 'open') {
    // Zaten bağlantı sayfasındaysak yeniden yükleme: sayfadaki hata satırı kaybolmasın.
    // (Ekran beklemeden önce değişir: aşağıdaki durdurma sırasında gelen bir kullanıcı kararını ezmez.)
    if (alive() && !onConnectPage) showConnectPage('manual');
    // Doğrulanamayan sunucu arkada çalışıp ağa yayın yapmasın: yalnızca BU çağrının başlattığı
    // alt süreç durdurulur; başka bir akışın başlattığına (hadHost) dokunulmaz.
    if (startedHere && serverHost === startedHere) {
      await startedHere.stop();
      if (serverHost === startedHere) serverHost = null;
      updateTray();
    }
    return false;
  }
  connectGeneration += 1; // bağlantı değişti: süren arka plan denemeleri sonuçlarını atsın
  autoPickSingle = true;
  foundDismissedUrl = null;
  rememberConnection(LOCAL_URL, action.identity, extra);
  retried = false;
  if (alive()) openServer(LOCAL_URL);
  return true;
}

async function enableServerMode() {
  if (!(await openOwnServer({ serverMode: true }))) {
    return { error: 'Bu bilgisayardaki sunucunun kimliği doğrulanamadı; sunucuya bağlanılmadı' };
  }
  return undefined;
}

async function requestServerMode() {
  if (confirmingHost) return { cancelled: true };
  confirmingHost = true;
  try {
    // Pencere tepsiye gizliyken ona bagli pencere (sheet) macOS'ta hic gorunmeyebilir.
    const parent = alive() && win.isVisible() ? win : undefined;
    const { response } = await dialog.showMessageBox(parent, HOST_CONFIRM);
    if (response !== 0) return { cancelled: true };
    const failed = await enableServerMode();
    return failed ?? { ok: true };
  } catch (err) {
    // Kimlik hatası: ayrıntı pencerede; sayfaya kısa satır, tepsi ikinci bir pencere açmaz (notified).
    if (isIdentityFailure(err)) {
      notifyIdentityFailure(err, true);
      return { error: hostFailureMessage(err, HOST_PORT), notified: true };
    }
    return { error: hostFailureMessage(err, HOST_PORT) };
  } finally {
    confirmingHost = false;
  }
}

// Tepsiden "Bu bilgisayarı sunucu yap": hata sessizce atılmaz. Kimlik hatası penceresi
// requestServerMode içinde zaten gösterildiyse (notified) ikinci pencere açılmaz.
async function hostFromTray() {
  let result;
  try {
    result = await requestServerMode();
  } catch {
    result = { error: 'Sunucu başlatılamadı' };
  }
  if (!result?.error || result.notified) return;
  const parent = alive() && win.isVisible() ? win : undefined;
  dialog
    .showMessageBox(parent, { type: 'error', title: 'Ipchat', message: 'Sunucu modu açılamadı.', detail: result.error })
    .catch(() => {});
}

async function disableServerMode() {
  connectGeneration += 1; // eski ayarla başlamış denemeler yerel sunucuyu yeniden kaydetmesin
  // Adresle birlikte hatırlanan kimlik de silinir; yoksa eski kendi sunucusu yüzünden uyarı görülürdü.
  saveConfig(configDir(), { ...withoutServer(loadConfig(configDir())), serverMode: false });
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

function serverLabelFor(url) {
  const found = knownServers.find((server) => server.url === url);
  if (found?.name) return found.name;
  try {
    const host = new URL(url).hostname;
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host) ? 'bu bilgisayar' : host;
  } catch {
    return '';
  }
}

// extra: kimliği değişen sunucu ({ url, name, fingerprint, legacy }), 'changed' ekranı için;
// 'found' ekranı için bulunan sunucu ({ url, name }).
function showConnectPage(mode, servers = [], extra) {
  setBadge(0);
  setUnreadCount(0);
  if (servers.length) knownServers = servers;
  else if (extra?.url && extra?.name) knownServers = [{ url: extra.url, name: extra.name }];
  tray?.update({ connected: false, serverLabel: '' });
  const query = { mode };
  if (servers.length) query.servers = JSON.stringify(servers);
  if (extra) query[mode === 'found' ? 'found' : 'changed'] = JSON.stringify(extra);
  foundShownUrl = mode === 'found' ? extra?.url ?? null : null;
  serverUrl = null;
  onConnectPage = true;
  win.loadFile(path.join(here, 'connect.html'), { query }).catch(() => {});
}

function openServer(url) {
  setBadge(0);
  setUnreadCount(0);
  serverUrl = url;
  onConnectPage = false;
  foundShownUrl = null;
  tray?.update({ connected: true, serverLabel: serverLabelFor(url) });
  win.loadURL(url).catch(() => {});
}

// Süren bağlanma bittiğinde, o sürerken ertelenmiş bir connectToServer isteği varsa bir kez çalıştırır.
function runPendingReconnect() {
  const run = shouldReconnect({ pending: reconnectPending, alive: Boolean(alive()), quitting });
  reconnectPending = false; // yeniden çalıştırmadan önce temizlenir: sonsuz döngü yok
  if (run) connectToServer();
}

async function connectToServer() {
  if (connecting) {
    // Süren iş (bu arada nesil değiştiyse sonucunu atacak) bitince yeniden çalıştırılır.
    reconnectPending = true;
    return;
  }
  connecting = true;
  const started = connectGeneration; // beklemeden önce
  const autoPick = autoPickSingle; // beklemeden önce
  try {
    if (loadConfig(configDir()).serverMode) {
      try {
        await openOwnServer({}, started);
        return;
      } catch (err) {
        // Atılan (eski) denemenin hatası gösterilmez; kimlik hatası penceresi dönem başına bir kez.
        if (stillCurrent(started)) {
          showConnectPage('manual');
          notifyIdentityFailure(err, false);
        }
        return;
      }
    }
    const result = await resolveServer({ configDir: configDir(), autoPickSingle: autoPick });
    serverKnown = networkServerKnown(result);
    updateTray();
    // Bu arada kullanıcı başka sunucuya bağlandıysa (ya da onayladıysa) sonuç atılır.
    if (!stillCurrent(started)) return;
    if (result.status === 'ok') {
      const found = decideFound(result, { dismissedUrl: foundDismissedUrl, shownUrl: foundShownUrl });
      if (found === 'show') {
        // Bilgi ekranı: kaydetme ve açma yok; sayfa bağlanmayı doğrulanmış yoldan (server:submit) yapar.
        showConnectPage('found', [], { url: result.url, name: result.name });
      } else if (found === 'skip') {
        // Aynı adresin bilgi ekranı zaten açıksa (geri sayım sürüyor) yeniden kurulmaz; kullanıcı bu
        // adresi geri çevirdiyse elle adres sayfası.
        if (!(onConnectPage && result.url === foundShownUrl)) showConnectPage('manual');
      } else {
        rememberConnection(result.url, result.identity);
        openServer(result.url);
      }
    } else if (result.status === 'changed') {
      const { url, name, fingerprint, legacy } = result;
      showConnectPage('changed', [], { url, name, fingerprint, legacy });
    } else {
      showConnectPage(result.status, result.servers);
    }
  } catch {
    if (stillCurrent(started)) showConnectPage('manual');
  } finally {
    connecting = false;
    runPendingReconnect();
  }
}

async function retryInBackground() {
  if (!onConnectPage || connecting || !alive()) return;
  connecting = true;
  const started = connectGeneration; // beklemeden önce
  const autoPick = autoPickSingle; // beklemeden önce
  try {
    const result = await resolveServer({ configDir: configDir(), autoPickSingle: autoPick });
    serverKnown = networkServerKnown(result);
    updateTray();
    // Yalnızca 'ok' işlenir; 'changed' arka planda ekran açmaz (kullanıcı zaten bağlantı sayfasında).
    // Bu arada kullanıcı bağlandıysa ya da sayfadan çıkıldıysa sonuç atılır.
    if (result.status === 'ok' && stillCurrent(started, true)) {
      const found = decideFound(result, { dismissedUrl: foundDismissedUrl, shownUrl: foundShownUrl });
      if (found === 'show') {
        // Elle adres/liste sayfasındaki kullanıcı bir anda geçirilmez: önce bilgi ekranı (geri sayımlı).
        showConnectPage('found', [], { url: result.url, name: result.name });
      } else if (found === 'open') {
        rememberConnection(result.url, result.identity);
        retried = false;
        openServer(result.url);
      }
      // 'skip': aynı bilgi ekranı zaten açık ya da kullanıcı bu adresi geri çevirdi; sayfa olduğu gibi.
    }
  } catch {
    /* sessizce gec, sayfa oldugu gibi kalir */
  } finally {
    connecting = false;
    runPendingReconnect();
  }
}

async function changeServer() {
  if (confirmingChange) return;
  confirmingChange = true;
  try {
    // Pencere tepsiye gizliyken ona bagli pencere (sheet) macOS'ta hic gorunmeyebilir.
    const parent = alive() && win.isVisible() ? win : undefined;
    const { response } = await dialog.showMessageBox(parent, CHANGE_SERVER_CONFIRM);
    if (response !== 0) return;
    autoPickSingle = false; // disableServerMode içindeki connectToServer'dan ÖNCE
    foundDismissedUrl = null;
    await disableServerMode();
  } finally {
    confirmingChange = false;
  }
}

function createWindow() {
  win = new BrowserWindow({
    ...windowOptions(),
    icon: path.join(here, '..', 'assets', 'icon.png'),
    webPreferences: webPreferences(path.join(here, 'preload.cjs')),
  });
  win.once('ready-to-show', () => win.show());

  win.on('close', (event) => {
    if (welcomePending) {
      // Onay yokken tepsi de yok: kapatma düğmesi uygulamayı kapatır, arkada onaysız süreç kalmaz.
      if (!quitting) {
        quitting = true;
        app.quit();
      }
      return;
    }
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
    // Onay ekranı hiçbir yere gidemez (welcome.html programla yüklenir; loadFile bu olayı tetiklemez).
    if (!welcomePending && shouldAllowNavigation(url, serverUrl, connectFileUrl)) return;
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
}

ipcMain.handle('server:submit', async (event, text) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  let url;
  try {
    url = normalizeServerUrl(text);
  } catch (err) {
    return { error: err.message };
  }
  // verifyServer'a yalnızca normalizeServerUrl çıktısı (http://host:port) verilir.
  const action = connectAction(await verifyServer(url, getPinned(loadConfig(configDir()))));
  if (action.action === 'confirm') {
    // Kimlik değişmiş: bağlanılmaz, hiçbir şey yazılmaz; sayfa onay ekranını gösterir.
    return { confirm: { url, name: serverLabelFor(url), ...action.info } };
  }
  if (action.action !== 'open') return { error: action.message };
  connectGeneration += 1; // kullanıcının kararı: süren arka plan denemeleri sonuçlarını atsın
  autoPickSingle = true;
  foundDismissedUrl = null;
  rememberConnection(url, action.identity);
  retried = false;
  openServer(url);
  return { ok: true };
});

// Kullanıcı "Bağlan ve yeni sunucuyu hatırla" dedi: yeni nonce ile yeniden doğrula ve yalnızca
// kullanıcının gördüğü kimlik (kısa parmak izi; eski sunucu için '') hâlâ aynıysa bağlan.
ipcMain.handle('server:confirm', async (event, text, shown) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  if (typeof text !== 'string' || typeof shown !== 'string') return { error: 'Geçersiz istek' };
  let url;
  try {
    url = normalizeServerUrl(text);
  } catch (err) {
    return { error: err.message };
  }
  const action = confirmAction(await verifyServer(url, getPinned(loadConfig(configDir()))), shown);
  if (action.action !== 'open') return { error: action.message };
  connectGeneration += 1; // kullanıcının kararı: süren arka plan denemeleri sonuçlarını atsın
  autoPickSingle = true;
  foundDismissedUrl = null;
  // Legacy onayında identity null: eski hatırlanan kimlik silinir.
  rememberConnection(url, action.identity);
  retried = false;
  openServer(url);
  return { ok: true };
});

// Bilgi ekranında "Başka bir adres yaz": bu adres oturum boyunca bilgi ekranıyla yeniden önerilmez.
ipcMain.handle('server:found-dismiss', (event, url) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  if (typeof url !== 'string' || url === '' || url.length > 2048) return { error: 'Geçersiz istek' };
  foundDismissedUrl = url;
  return { ok: true };
});

ipcMain.handle('server:host', async (event) => {
  if (!isTrustedSender(event.senderFrame?.url, connectFileUrl)) return { error: 'İzin verilmedi' };
  return requestServerMode();
});

// Onaydan sonra (ya da onay gerekmiyorsa hemen) çalışan açılış sırası. Normal açılış ve onay sonrası
// aynı fonksiyonu kullanır, iki yol birbirinden ayrışamaz. Yalnızca bir kez çalışır.
let startupDone = false;
function startApp() {
  if (startupDone) return;
  startupDone = true;
  const config = loadConfig(configDir());
  if (app.isPackaged && !config.autostartInitialized) {
    app.setLoginItemSettings(loginItemSettings(true));
    try {
      saveConfig(configDir(), { ...config, autostartInitialized: true });
    } catch {
      /* ayar yazılamadıysa bir sonraki açılışta yeniden kaydedilir; uygulama açılmaya devam eder */
    }
  }
  if (process.platform === 'win32' && app.isPackaged) {
    // Önceki kaldırma hesapları geçici klasörde bıraktıysa yönetici bilsin; klasöre dokunulmaz.
    let tmpExists = false;
    try {
      tmpExists = fs.existsSync(path.join(path.dirname(configDir()), 'ipchat-server-data-tmp'));
    } catch {
      tmpExists = false;
    }
    const leftover = leftoverServerDataNotice(configDir(), tmpExists);
    if (leftover) dialog.showMessageBox({ type: 'warning', title: 'Ipchat', message: leftover.message, detail: leftover.detail });
  }
  tray = createTray({
    showWindow,
    changeServer,
    uninstall: uninstallEverything,
    hostServer: () => hostFromTray(),
    stopHosting: disableServerMode,
    quit: async () => {
      quitting = true;
      await serverHost?.stop();
      app.quit();
    },
    isAutoStart: () => app.getLoginItemSettings(loginItemQuery()).openAtLogin,
    setAutoStart: (value) => app.setLoginItemSettings(loginItemSettings(value)),
  });
  if (!alive()) createWindow(); // onay yolunda pencere zaten açık
  connectToServer();
  setInterval(retryInBackground, RETRY_INTERVAL_MS).unref();
}

// İlk açılış onayı köprüleri: yalnızca welcome.html kullanabilir.
ipcMain.handle('welcome:text', (event) => {
  if (!isTrustedSender(event.senderFrame?.url, welcomeFileUrl)) return { error: 'İzin verilmedi' };
  return { removal: removalRule(process.platform) };
});

ipcMain.handle('welcome:accept', (event) => {
  if (!isTrustedSender(event.senderFrame?.url, welcomeFileUrl)) return { error: 'İzin verilmedi' };
  // Onay beklenmiyorsa (zaten verildi) açılış yeniden çalıştırılmaz.
  if (!welcomePending) return { error: 'Onay zaten verildi' };
  try {
    saveConfig(configDir(), { ...loadConfig(configDir()), welcomeAccepted: welcomeRecord(new Date()) });
  } catch {
    /* onay kaydedilemedi: bu oturum devam eder, bir sonraki açılışta ekran yeniden çıkar (tasarım §7.4.1) */
  }
  welcomePending = false;
  startApp();
  return { ok: true };
});

ipcMain.handle('welcome:quit', (event) => {
  if (!isTrustedSender(event.senderFrame?.url, welcomeFileUrl)) return { error: 'İzin verilmedi' };
  // Onay verildikten sonra bu köprüyle uygulama kapatılamaz.
  if (!welcomePending) return { error: 'Onay zaten verildi' };
  // Hiçbir şey kaydedilmez; bir sonraki açılışta ekran yeniden çıkar.
  quitting = true;
  app.quit();
  return { ok: true };
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
    // Pencere çerçevesi ve sistem iletişim kutuları koyu olsun (Windows başlık çubuğunda etkisi sistem sürümüne bağlı).
    nativeTheme.themeSource = 'dark';
    if (needsWelcome(loadConfig(configDir()), app.isPackaged)) {
      // Kapı (tasarım §7.4): yalnızca pencere ve onay ekranı. Gerisi welcome:accept'te startApp ile.
      welcomePending = true;
      createWindow();
      win.loadFile(path.join(here, 'welcome.html')).catch(() => {});
      return;
    }
    startApp();
  });
}

if (app.requestSingleInstanceLock()) {
  start();
} else {
  app.exit(0);
}
