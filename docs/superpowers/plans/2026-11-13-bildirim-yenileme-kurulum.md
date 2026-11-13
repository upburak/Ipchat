# Bildirim, 3 Sn Yenileme, Yönetici Onaylı Kurulum/Kaldırma ve B Tasarımı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kişi listesi 3 sn'de bir yenilensin, yöneticiye yeni hesap isteği rozet+bildirimle gelsin, Windows kurulumu/kaldırması güvenlik duvarı ve veriyi doğru yönetsin, arayüz B tarzına geçsin.

**Architecture:** Sunucuya hafif bir `pending-count` ucu eklenir. Web arayüzü 3 sn'de bir yoklar; saf mantık (birleştirme, yeni-hesap tespiti) test edilebilir küçük modüllerde durur. Masaüstü ana süreci `notify`/`setBadge` köprüsünü yalnızca bağlı sunucunun sayfasına açar. NSIS betiği kurulum/kaldırma adımlarını yapar.

**Tech Stack:** Node.js (`node:test`), Express, React+zustand+Vite, Electron 45.3.2, electron-builder NSIS.

**Spec:** `docs/superpowers/specs/2026-11-13-bildirim-yenileme-kurulum-tasarim-design.md` (tasarım taslağı: `docs/superpowers/specs/assets/tasarim-taslaklari.html`, B seçildi).

## Global Constraints

- Yenileme aralığı tam olarak **3000 ms** (`POLL_MS`).
- Pencere 800x620 büyütülemez; arayüz 820 px'ten dar veya 620 px'ten alçak pencerede tüm pencereyi doldurur (mevcut kural korunur).
- Bildirim kararı **daha önce görülmemiş hesap kimliğine** göre verilir; oturum sonrası ilk okumada bildirim yok, yalnızca rozet.
- Köprü yalnızca `notify` ve `setBadge`; çağrının çerçeve kaynağı, bağlı sunucunun kaynağıyla aynı olmalı; `connect.html` bu işlevleri kullanamaz.
- Güvenlik duvarı kuralları: TCP 3000 ve UDP 41234, ad `Ipchat`, tüm profiller. Kurulum `perMachine: true`, `oneClick: true`.
- Kaldırıcı veriyi silmeden önce bir kez sorar (varsayılan Evet); sessiz kaldırmada (`/S`) veri silinmez; yalnızca kaldırmayı başlatan kullanıcının profilini hedefler.
- Renkler: yüzey `#ffffff`, zemin `#f3f4f8`, kenarlık `#e6e8ef`, metin `#1d2433`, vurgu `#6366f1`, çevrimiçi `#22c55e`, rozet `#ef4444`; köşe 12 px.
- Arayüz metinleri Türkçe. Yeni bağımlılık eklenmez.

## Review Focus

- Yoklamada iki istek arasında biri onaylanıp biri kayıt olursa bildirim kaçmamalı (Task 2: `trackPending`).
- Yenileme çevrimiçi durumunu ezmemeli, açık sohbeti bozmamalı (Task 2: `mergeContacts`).
- Başka bir sunucunun/sitenin sayfası köprüyü çağıramamalı (Task 4: `isServerSender`).
- Güvenlik duvarı ilkesi kaydı yoksa/okunamazsa "kısıtlı" sayılmamalı ve uygulama çökmemeli (Task 5).
- Kaldırıcı betiği veri silme sorusunu ve güvenlik duvarı temizliğini içermeli (Task 7).

---

### Task 1: Sunucu `pending-count` ucu

**Files:**
- Modify: `server/src/admin.js`, `server/src/routes/admin.js`
- Test: `server/test/admin.test.js`

**Interfaces:**
- Produces: `pendingSummary(): { count: number, latest: Array<{ id: number, username: string }> }` (`latest`: en yeni en fazla 5 `pending` hesap, `id` azalan); `GET /api/admin/pending-count` → bu nesne (yönetici gerektirir: 401/403 mevcut ara katmanlarla).

- [ ] **Step 1: Başarısız testler (`admin.test.js` içine):** `pending-count returns count and latest pending accounts` (iki bekleyen hesap → `count === 2`, `latest[0].username` en yeni olan); `pending-count is 403 for non-admin`; `pending-count caps latest at 5`.
- [ ] **Step 2:** `npm test -w server` → FAIL.
- [ ] **Step 3:** `pendingSummary` ve rotayı uygula (`/admin` ara katmanları altında).
- [ ] **Step 4:** PASS. **Step 5:** Commit (`feat: bekleyen hesap ozet ucu`).

### Task 2: Yoklama mantığı (saf modül)

**Files:**
- Create: `web/src/lib/polling.js`
- Test: `web/test/polling.test.js`; Modify: `web/package.json` (`"test": "node --test"`)

**Interfaces:**
- Produces: `export const POLL_MS = 3000`; `mergeContacts(fetched: Array<{id,username,online?}>, presence: Record<number, boolean>): Array<{id,username,online:boolean}>` (`presence[id]` tanımlıysa o, değilse `fetched.online ?? false`); `trackPending(seen: Set<number>, latest: Array<{id,username}>, first: boolean): { seen: Set<number>, fresh: Array<{id,username}> }` (ilk okumada `fresh` boş, `seen` hepsi; sonra yalnızca görülmemiş kimlikler); `notificationText(fresh): { title: string, body: string }`.

- [ ] **Step 1: Testler:** `POLL_MS is 3000`; `mergeContacts keeps live presence over fetched flag`; `mergeContacts defaults online to false`; `trackPending first read marks seen but notifies nothing`; `trackPending reports only unseen ids even when count is unchanged` (görülen {1}, latest [2] → fresh [2]); `notificationText for one` (başlık "Yeni hesap isteği", gövde kullanıcı adı); `notificationText for many` (gövde "3 yeni hesap isteği").
- [ ] **Step 2:** `npm test -w web` → FAIL. **Step 3:** Uygula. **Step 4:** PASS. **Step 5:** Commit.

### Task 3: Web bağlantıları (yoklama, rozet, bildirim çağrısı)

**Files:**
- Modify: `web/src/lib/api.js` (`adminPendingCount()`), `web/src/state/store.js` (`pendingCount`, `setPendingCount`), `web/src/pages/ChatApp.jsx`, `web/src/components/AdminPanel.jsx`

**Interfaces:**
- Consumes: Task 1 ucu; Task 2 `POLL_MS`, `mergeContacts`, `trackPending`, `notificationText`; masaüstü köprüsü `window.ipchat?.notify({title, body})` ve `window.ipchat?.setBadge(count)` (Task 4; yoksa sessizce atlanır).

- [ ] **Step 1:** `ChatApp` her `POLL_MS`'de `api.listUsers()` çağırıp `setContacts(mergeContacts(...))` yapar; yöneticiyse `adminPendingCount()` ile `pendingCount`'u günceller, `trackPending` ile `fresh` varsa bildirim çağırır, `setBadge(count)` çağırır. Aralıklar çıkışta temizlenir. Hata olursa sessizce bir sonrakini bekler. `AdminPanel` açıkken liste de 3 sn'de bir yenilenir.
- [ ] **Step 2:** "Hesaplar" düğmesinde `pendingCount > 0` ise kırmızı sayı rozeti.
- [ ] **Step 3 (doğrulama):** `npm run build` hatasız; temiz veritabanlı sunucuda iki hesap ile: ikinci hesap kayıt olunca yönetici ≤3 sn'de rozeti görür; yönetici onaylayınca üçüncü kullanıcının listesinde ≤3 sn'de belirir (tarayıcı ile). **Step 4:** Commit.

### Task 4: Masaüstü köprüsü, bildirim, rozet

**Files:**
- Modify: `desktop/src/navigation.js`, `desktop/src/preload.cjs`, `desktop/src/main.js`, `desktop/src/tray.js`, `desktop/src/window-options.js`
- Create: `desktop/assets/icon-alert.png`, `desktop/assets/icon-server-alert.png` (mevcut ikonların kırmızı noktalı 512 px varyantları)
- Test: `desktop/test/navigation.test.js`, `desktop/test/window-options.test.js`

**Interfaces:**
- Produces: `isServerSender(senderUrl: string | undefined, serverUrl: string | null): boolean` (iki adres geçerli ve **kaynakları (origin) eşit** ise true); `webPreferences(preloadPath: string)` → `{ preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }`; IPC `app:notify` (`{title, body}`, metinler 120 karakterle kısaltılır), `app:badge` (`number`); tray `update({ badge })`.

- [ ] **Step 1: Testler:** `isServerSender accepts the connected server origin`; `isServerSender rejects other origins, file urls, undefined and null server`; `webPreferences disables background throttling and keeps isolation`.
- [ ] **Step 2:** FAIL. **Step 3:** Uygula; ana süreçte bildirim `electron.Notification` ile, tıklanınca `showWindow()` ve sayfaya `ipchat:open-admin` gönderilir (preload `onOpenAdmin(cb)`); rozet: tepside `badge>0` iken uyarı ikonları ve ipucu "N bekleyen hesap", Mac'te `app.dock.setBadge` ve `tray.setTitle`.
- [ ] **Step 4:** PASS. **Step 5:** Commit.

### Task 5: Güvenlik duvarı ilkesi tespiti

**Files:**
- Create: `desktop/src/firewall-policy.js`
- Modify: `desktop/src/main.js`, `desktop/src/tray.js`, `desktop/src/connect.html`
- Test: `desktop/test/firewall-policy.test.js`

**Interfaces:**
- Produces: `parseRegQuery(output: string): number | null` (`reg query` çıktısındaki `AllowLocalPolicyMerge    REG_DWORD    0x0` satırından sayı; satır yoksa `null`); `policyRestricted(values: Array<number | null>): boolean` (herhangi biri `0` ise true); `readFirewallPolicy(): Promise<{ restricted: boolean }>` (yalnızca `win32`; diğer platformlarda ve hatada `{restricted:false}`).

- [ ] **Step 1: Testler:** `parseRegQuery reads 0x0 as 0 and 0x1 as 1`; `parseRegQuery returns null when value is absent`; `policyRestricted is true if any profile is 0`; `policyRestricted ignores null and 1`.
- [ ] **Step 2–4:** FAIL → uygula (`reg query "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\<Domain|Private|Public>Profile" /v AllowLocalPolicyMerge`, `windowsHide`) → PASS. Sunucu modu açılınca `restricted` ise tepside devre dışı uyarı satırı ve bağlantı sayfasında metin ("Bu bilgisayarın güvenlik duvarı kurum tarafından yönetiliyor. Başka cihazlar sunucuya bağlanamayabilir. Sunucuyu başka bir bilgisayarda çalıştırmayı dene.").
- [ ] **Step 5:** Commit.

### Task 6: "Ipchat'i tamamen kaldır" (Mac) ve Windows kısayolu

**Files:**
- Create: `desktop/src/uninstall.js`
- Modify: `desktop/src/main.js`, `desktop/src/tray.js`
- Test: `desktop/test/uninstall.test.js`

**Interfaces:**
- Produces: `appBundlePath(execPath: string): string | null` (`.../Ipchat.app/Contents/MacOS/Ipchat` → `.../Ipchat.app`; başka yol → `null`); ana süreçte `uninstallEverything()`.

- [ ] **Step 1: Testler:** `appBundlePath finds the .app bundle from the executable`; `appBundlePath returns null for non-mac paths`.
- [ ] **Step 2–4:** FAIL → uygula → PASS. Mac: `dialog.showMessageBox` ("Sohbet geçmişi de silinsin mi?" onay kutusu varsayılan **işaretli**), sunucuyu durdur, `setLoginItemSettings({openAtLogin:false})`, işaretliyse `userData` sil, `shell.trashItem(appBundlePath(process.execPath))`, `app.exit(0)`. Windows: menü öğesi `shell.openExternal('ms-settings:appsfeatures')`.
- [ ] **Step 5:** Commit.

### Task 7: Windows kurulumu ve kaldırıcısı (NSIS)

**Files:**
- Create: `desktop/build/installer.nsh`
- Modify: `desktop/package.json` (`build.nsis`: `oneClick: true`, `perMachine: true`, `include: "build/installer.nsh"`, `deleteAppDataOnUninstall: false`)
- Test: `desktop/test/installer.test.js`

**Interfaces:**
- Produces: `installer.nsh` makroları `customInit` (eski kullanıcı-başına kurulumu algıla ve sessizce kaldır), `customInstall` (iki `netsh advfirewall firewall add rule name="Ipchat"` kuralı: TCP 3000 ve UDP 41234, `profile=any`), `customUnInstall` (`taskkill /F /IM Ipchat.exe`, `netsh advfirewall firewall delete rule name="Ipchat"`, kaldırmayı başlatan kullanıcının otomatik başlatma kaydını sil; sessiz değilse `MessageBox MB_YESNO|MB_DEFBUTTON1` ile "Sohbet geçmişi ve ayarlar da silinsin mi?" sorusu, Evet ise `RMDir /r "$APPDATA\ipchat-desktop"`).

- [ ] **Step 1: Test (dosya içeriği):** `installer script adds both firewall rules`; `installer script removes firewall rules and kills the app on uninstall`; `installer script asks before deleting data and defaults to yes`; `package.json nsis is perMachine and oneClick`.
- [ ] **Step 2–4:** FAIL → uygula → PASS. **Not:** NSIS betiği bu Mac'te çalıştırılamaz; gerçek doğrulama CI derlemesinin başarısı ve Windows'ta elle denemedir (ledger'a yaz).
- [ ] **Step 5:** Commit.

### Task 8: B tasarımı

**Files:**
- Create: `web/src/lib/avatar.js`
- Modify: `web/src/style.css`, `web/src/components/ContactList.jsx`, `web/src/components/ChatWindow.jsx`, `web/src/components/AdminPanel.jsx`, `web/src/components/GroupCreateModal.jsx`, `web/src/pages/LoginScreen.jsx`, `web/src/pages/ConnectScreen.jsx`, `desktop/src/connect.html`
- Test: `web/test/avatar.test.js`

**Interfaces:**
- Produces: `initial(name: string): string` (ilk harf, büyük; boş ad için `?`); `avatarColor(name: string): string` (sabit paletten deterministik renk; aynı ad her zaman aynı renk).

- [ ] **Step 1: Testler:** `initial uppercases the first letter and handles empty`; `avatarColor is deterministic and comes from the palette`.
- [ ] **Step 2–4:** FAIL → uygula → PASS. Sonra Global Constraints'teki renk ve köşe değerleriyle ekranları `tasarim-taslaklari.html` B kartına göre yeniden stille: yuvarlak harfli avatarlar, durum noktası, yuvarlak balonlar (gönderen sağda vurgu renginde, karşı taraf solda beyaz; konuşmacı köşesi 2 px), rozet.
- [ ] **Step 5 (doğrulama):** `npm run build`; tarayıcıda giriş, sohbet ve Hesaplar ekranlarının ekran görüntüsü kontrolü. **Step 6:** Commit.

### Task 9: Sürüm, belgeler, paketleme

**Files:**
- Modify: `desktop/package.json` (`version: "0.2.0"`), `README.md`, `.github/workflows/build-desktop.yml` (gerekirse)

- [ ] **Step 1:** README: kurulumda yönetici izni, güvenlik duvarı kuralları, kaldırma davranışı ve veri silme sorusu, kurum güvenlik duvarı uyarısı, Mac "tamamen kaldır", bildirim/rozet.
- [ ] **Step 2:** `npm test -w server`, `-w web`, `-w desktop` hepsi geçsin. **Step 3:** `main`'e gönder, derleme akışını çalıştır, Windows `.exe` ve Mac zip artefaktlarını indir. **Step 4:** Commit.
