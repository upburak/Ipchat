# M2: Electron Kabuğu ve Sunucu Keşfi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ipchat'in sohbet istemcisini, sunucuyu ağda kendisi bulan, sabit boyutlu, sistem tepsisinde yaşayan ve oturum açılışında kendiliğinden başlayan bir Electron masaüstü uygulamasına dönüştürmek.

**Architecture:** Sunucu, UDP yayın ("broadcast") sorgusuna yanıt veren küçük bir keşif servisi alır. Yeni `desktop/` çalışma alanı (workspace) bir Electron ana süreci içerir: sunucuyu UDP ile bulur, bulduğu adresi hatırlar ve mevcut web arayüzünü sunucudan yükler. Bulunamazsa yerel bir "sunucu adresi" sayfası gösterir. Ajan ve paylaşım M3'tür, bu planda yoktur.

**Tech Stack:** Node.js (`dgram`, `node:test`), Electron, electron-builder (Windows NSIS hedefi).

**Spec:** `docs/superpowers/specs/2026-11-13-ipchat-dosya-paylasimi-design.md` (bölüm 7.2, 3, 5). Önceki plan: M1 (`2026-11-13-m1-hesap-onayi.md`) tamamlandı.

## Global Constraints

- Sohbet penceresi **boyutlandırılamaz**, 800x620 piksel, Messenger benzeri (kullanıcı özellikle istedi): `resizable: false`, `maximizable: false`, `fullscreenable: false`.
- Pencere kapatılınca uygulama **çıkmaz**, sistem tepsisine iner; yalnızca tepsi menüsündeki "Çık" uygulamayı kapatır.
- Tek örnek: ikinci kez açılırsa mevcut pencereyi öne getirir.
- Bilgisayar/oturum açılışında otomatik başlar (kullanıcı tepsi menüsünden kapatabilir).
- Sunucu keşfi UDP port `41234`; sorgu metni tam olarak `IPCHAT_DISCOVER`; yanıt JSON: `{"app":"ipchat","port":<sayi>,"name":<bilgisayar-adi>}`.
- Sunucu bulunamazsa uygulama takılmaz: yerel sayfada adres elle girilebilir ve girilen adres kalıcı hatırlanır.
- Arayüz metinleri Türkçe. Web arayüzü kodu değiştirilmez: sunucudan olduğu gibi yüklenir.
- İlk hedef Windows; kod Mac/Linux'u engellemez. Yeni bağımlılık yalnızca `electron` ve `electron-builder` (dev).

## Review Focus

- Ağda iki sunucu cevap verirse: ilk cevap veren değil, daha önce hatırlanan sunucu tercih edilir; hatırlanan yoksa kullanıcıya liste gösterilir.
- Hatırlanan sunucunun IP'si değişmiş (yüklenemiyor): uygulama yeniden keşif yapar, sonra elle girişe düşer, sonsuz döngüye girmez.
- Güvenlik duvarı UDP'yi engellerse: keşif zaman aşımına uğrar ve elle giriş sayfası açılır.
- Uygulama ikinci kez başlatılınca ikinci pencere/tepsi ikonu oluşmaz.
- Elle girilen adres `http://` olmadan, boşluklu veya portsuz gelse bile normalize edilir (varsayılan port 3000); `javascript:` gibi şemalar reddedilir.

---

### Task 1: Sunucu keşif servisi

**Files:**
- Create: `server/src/discovery.js`
- Modify: `server/src/index.js` (sunucu dinlemeye başlayınca `startDiscovery(PORT)` çağır)
- Test: `server/test/discovery.test.js`

**Interfaces:**
- Produces: `startDiscovery(httpPort: number, { udpPort = 41234, name = os.hostname() } = {}): { close(): void, port: number }` — `IPCHAT_DISCOVER` içeren paketlere gönderene unicast JSON yanıt verir, diğer paketleri yok sayar; `udpPort: 0` rastgele boş port açar (`port` bunu döndürür).

- [ ] **Step 1: Başarısız testler:** `answers IPCHAT_DISCOVER with app, port and name` (127.0.0.1'e gönder, `{app:'ipchat', port:3000, name:'test-pc'}` bekle); `ignores unrelated packets` (rastgele metin gönder, 300 ms içinde yanıt gelmediğini doğrula).
- [ ] **Step 2: FAIL gör:** `npm test -w server`
- [ ] **Step 3: Uygula** (`dgram.createSocket({type:'udp4', reuseAddr:true})`, `0.0.0.0`'a bağla, hatalarda sunucuyu düşürme: dinleme hatası yalnızca uyarı olarak loglanır).
- [ ] **Step 4: PASS gör**, **Step 5: Commit** (`feat: udp sunucu kesif servisi`).

### Task 2: Keşif istemcisi ve kalıcı ayar (saf Node, Electron'dan bağımsız)

**Files:**
- Create: `desktop/package.json`, `desktop/src/discovery-client.js`, `desktop/src/config.js`, `desktop/src/normalize-url.js`
- Modify: kök `package.json` (workspaces'e `desktop` ekle)
- Test: `desktop/test/discovery-client.test.js`, `desktop/test/config.test.js`, `desktop/test/normalize-url.test.js`

**Interfaces:**
- Consumes: Task 1'in `startDiscovery` (testte gerçek sunucu keşfi başlatılır).
- Produces:
  - `discoverServers({ udpPort = 41234, timeoutMs = 2000, broadcastAddress = '255.255.255.255' } = {}): Promise<Array<{ url: string, name: string }>>` (yanıt veren her adres için `http://<gonderen-ip>:<port>`, aynı url bir kez).
  - `loadConfig(dir): { lastServer?: string }` ve `saveConfig(dir, config): void` (`dir/config.json`, bozuk/eksik dosyada `{}` döner, hata fırlatmaz).
  - `normalizeServerUrl(input: string): string` — `192.168.1.10` → `http://192.168.1.10:3000`; `host:8080` → `http://host:8080`; `http(s)://` ile gelen aynen korunur; boşluk kırpılır; `http`/`https` dışı şema veya boş girdi için `Error('Geçersiz sunucu adresi')` fırlatır.

- [ ] **Step 1: Başarısız testler:** `finds a server that answers on loopback` (broadcastAddress '127.0.0.1', udpPort 0 yerine testte açılan portu ver); `returns empty list on timeout`; `deduplicates the same server`; `loadConfig returns {} for missing or corrupt file`; `saveConfig then loadConfig round-trips`; `normalizeServerUrl` için: `'192.168.1.10'`, `' host:8080 '`, `'https://a.b'`, `''`, `'javascript:alert(1)'`, `'ftp://x'`.
- [ ] **Step 2: FAIL gör:** `npm test -w desktop` (`"test": "node --test"`)
- [ ] **Step 3: Uygula** (sorgu için `socket.setBroadcast(true)`; zaman aşımında soketi kapat).
- [ ] **Step 4: PASS gör**, **Step 5: Commit** (`feat: kesif istemcisi, ayar ve adres normalizasyonu`).

### Task 3: Sunucu seçme mantığı

**Files:**
- Create: `desktop/src/resolve-server.js`
- Test: `desktop/test/resolve-server.test.js`

**Interfaces:**
- Consumes: Task 2'nin `discoverServers`, `loadConfig`, `saveConfig`, `normalizeServerUrl`; `isReachable(url, timeoutMs): Promise<boolean>` (bu task'ta tanımlanır; `GET <url>/api/health` yanıtı `app === 'ipchat'` ise true).
- Produces: `resolveServer({ configDir, discover = discoverServers, reachable = isReachable }): Promise<{ status: 'ok', url } | { status: 'choose', servers: [...] } | { status: 'manual' }>`. Karar sırası: hatırlanan sunucu ulaşılabiliyorsa `ok`; değilse keşif: tek sonuç → `ok` (kaydedilir), birden çok → `choose`, hiç → `manual`. Hatırlanan sunucu keşif sonucunda yer alıyorsa o seçilir.

- [ ] **Step 1: Başarısız testler (bağımlılıklar sahte fonksiyonla):** `uses remembered server when reachable`; `rediscovers when remembered server is unreachable and saves the new one`; `prefers remembered server among several discovered`; `returns choose for several unknown servers`; `returns manual when nothing found`; `does not loop: calls discover at most once per resolve`.
- [ ] **Step 2–5:** FAIL → uygula → PASS → Commit (`feat: sunucu secme mantigi`).

### Task 4: Electron ana süreci ve pencere

**Files:**
- Create: `desktop/src/main.js`, `desktop/src/window.js`, `desktop/src/tray.js`, `desktop/src/preload.js`, `desktop/src/connect.html`
- Modify: `desktop/package.json` (`electron` bağımlılığı, `"main": "src/main.js"`, `"start": "electron ."`)
- Test: `desktop/test/window-options.test.js`

**Interfaces:**
- Consumes: `resolveServer` (Task 3), `normalizeServerUrl`, `saveConfig` (Task 2).
- Produces: `windowOptions(): { width: 800, height: 620, resizable: false, maximizable: false, fullscreenable: false, ... }` (saf fonksiyon, Electron'suz test edilebilir); IPC kanalı `server:submit` (adres metni alır, normalize eder, kaydeder, yükler; geçersizse hata mesajı döner); `connect.html` sunucu listesi (`choose`) veya adres kutusu (`manual`) gösterir.

- [ ] **Step 1: Başarısız test:** `window options are fixed 800x620 and not resizable` (yukarıdaki değerler tam eşleşir).
- [ ] **Step 2: FAIL**, **Step 3: Uygula:** ana süreç açılışta `resolveServer` çağırır; `ok` → pencereye URL yüklenir; `choose`/`manual` → `connect.html`. `app.requestSingleInstanceLock()`, pencere `close` olayında `preventDefault()` + `hide()`, `tray.js` tepsi menüsü ("Aç", "Açılışta otomatik başlat" onay kutusu, "Çık"), `app.setLoginItemSettings({ openAtLogin })`. Yüklenen sayfa `did-fail-load` verirse en fazla bir kez yeniden keşif, sonra `connect.html`.
- [ ] **Step 4: PASS**, **Step 5: Commit** (`feat: electron kabugu, tepsi ve sabit pencere`).
- [ ] **Doğrulama (elle, Mac'te):** sunucuyu başlat, `npm start -w desktop`: pencere 800x620 açılır ve büyütülemez; sunucuyu keşfedip giriş ekranını gösterir; pencereyi kapatınca tepsiye iner; ikinci `npm start` yeni pencere açmaz; sunucu kapalıyken adres ekranı çıkar.

### Task 5: Windows paketleme ve dokümantasyon

**Files:**
- Modify: `desktop/package.json` (`electron-builder` devDependency, `"build"` ayarı: `appId`, `productName: "Ipchat"`, `win.target: nsis`, `"dist": "electron-builder --win"`), kök `README.md` (masaüstü uygulaması bölümü)

- [ ] **Step 1:** Yapılandırmayı ekle; Mac'te `npm run dist -w desktop -- --dir` ile paketlemenin hatasız ürettiğini doğrula (Windows kurulum dosyası Windows'ta veya CI'da üretilir; bunu README'ye yaz).
- [ ] **Step 2:** README'ye şunları yaz: sunucu keşfi (UDP 41234, güvenlik duvarında izin gerekebilir), adres elle girilebilir, kurulum ve otomatik başlatma. `kurulum.ps1` istemci seçeneği Electron yayınlanana kadar mevcut kısayol yöntemiyle kalır (bu planda değiştirilmez).
- [ ] **Step 3: Commit** (`feat: windows paketleme ayari ve dokumantasyon`).
