# Temiz Kaldırma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kaldırma, istemci bilgisayarda soru sormadan hiçbir iz bırakmasın; sunucu bilgisayarında hesapları ve mesaj geçmişini korusun; kullanıcı bunu hem kurulumda hem kaldırmada okusun.

**Architecture:** Karar mantığı ve bütün metinler, Electron'a bağlı olmayan yeni bir saf modülde (`desktop/src/cleanup.js`) toplanır ve `node:test` ile sınanır. Windows tarafı NSIS betiğidir; o da çalıştırılamadığı için **metin olarak** sınanır — depoda bunun kalıbı zaten var (`desktop/test/installer.test.js` `.nsh` dosyasını okuyup düzenli ifadeyle denetliyor). Mac tarafı `main.js` içinde ince bir kabuk olarak kalır.

**Tech Stack:** Electron 45.3.2, NSIS (electron-builder), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-26-temiz-kaldirma-design.md`

## Global Constraints

- Yeni bağımlılık yok. Testler yalnızca `node:test`.
- Electron tam olarak 45.3.2; `oneClick: true` ve `perMachine: true` NSIS ayarları değişmez.
- Tüm kullanıcıya görünen metinler Türkçe ve belgedeki haliyle birebir.
- Korunacak tek şey `server-data` klasörüdür; başka hiçbir şey korunmaz.
- Güncellemede (`isUpdated`) hiçbir şeye dokunulmaz.
- Commit mesajlarının sonunda, boş satırdan sonra birebir:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YLavgjuvpq1b8f62aHefF1
```

## Review Focus

1. **Taşıma başarısız olursa veri silinmemeli.** Windows'ta sunucu verisi, klasör silinmeden önce geçici bir yere taşınır. Taşıma başarısız olursa (disk dolu, dosya kilitli) silme **yapılmamalı** — yoksa korumak için yazdığımız kod veriyi yok eder (Görev 2).
2. **Uygulama çalışırken kaldırma.** Dosyalar kilitliyken silme sessizce başarısız olur ve iz kalır; `taskkill` adımı silmeden **önce** çalışmalı (Görev 2).
3. **Bir kez sunucu olmuş istemci.** Sunucu modu açılıp kapatılmış bir bilgisayarda **boş** bir `server-data` kalmış olabilir. İki platform burada ayrışmamalı: NSIS'in `IfFileExists "…\server-data\*.*"` biçimi boş klasörde **yanlış** döner, oysa `fs.existsSync` **doğru** döner. Mac tarafı da "var ve boş değil" kuralını uygulamalı, yoksa aynı bilgisayar Windows'ta istemci, Mac'te sunucu sayılır (Görev 1 ve 3).
4. **Yolda boşluk veya tırnak.** Mac'te kullanıcı verisi yolu boşluk içerebilir (`Application Support`); silme komutu yolu kabuğa **değişken olarak** geçirmeli, metne gömmemeli (Görev 1).
5. **İlk açılış bildirimi bir kez.** Mac'te metin her açılışta değil yalnızca bir kez görünmeli, ve ayar dosyası yazılamazsa uygulama yine de açılmalı (Görev 1 ve 3).

---

### Task 1: Saf karar mantığı ve metinler

**Files:**
- Create: `desktop/src/cleanup.js`
- Test: `desktop/test/cleanup.test.js`

**Interfaces:**
- Produces (adlandırılmış dışa aktarımlar, varsayılan yok, `electron` içe aktarılmaz):
  - `INSTALL_NOTICE: { message: string, detail: string }` — kurulum/ilk açılış metni.
  - `uninstallConfirm(hasServerData: boolean, serverDataPath: string): { message, detail, buttons, defaultId, cancelId }` — Mac onay penceresi; `buttons` her zaman `['Kaldır', 'Vazgeç']`, `defaultId` ve `cancelId` **1** (Vazgeç).
  - `purgeArgs(userDataDir: string, keepServerData: boolean): string[]` — `spawn('/bin/sh', …)` için argüman dizisi.
  - `shouldShowInstallNotice(config: object): boolean` — `config.installNoticeShown` doğru değilse `true`.
  - `hasServerData(entries: string[] | null): boolean` — dizi ve boş değilse `true`. NSIS'in `IfFileExists "…\*.*"` davranışını birebir karşılar: var olan ama **boş** bir `server-data` sunucu sayılmaz.

- [ ] **Step 1: Write the failing test**

`desktop/test/cleanup.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && node --test test/cleanup.test.js`
Expected: FAIL — `../src/cleanup.js` bulunamadı.

- [ ] **Step 3: `desktop/src/cleanup.js` dosyasını yaz**

Metinler tasarım belgesinin §7.5 bölümünden birebir alınır. `purgeArgs` `sleep 2` ile başlar (uygulama kapanana kadar bekler, bugünkü davranış) ve yolu `"$1"` olarak kullanır. Koruma gereken durumda, klasörün içindekiler `server-data` dışında silinir; gizli dosyalar da kapsanmalı.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w desktop`
Expected: PASS — tüm masaüstü testleri.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/cleanup.js desktop/test/cleanup.test.js
git commit -m "feat(masaustu): temiz kaldirma karar mantigi ve metinleri"
```

---

### Task 2: Windows kurulum ve kaldırma betiği

**Files:**
- Modify: `desktop/build/installer.nsh`
- Test: `desktop/test/installer.test.js`

**Interfaces:**
- Consumes: Görev 1'in metinleri **kavram olarak** (NSIS betiği JavaScript'i içe aktaramaz; metinler betiğe elle yazılır ve iki yerde aynı anlamı taşır).

- [ ] **Step 1: Write the failing test**

`desktop/test/installer.test.js` içinde **iki mevcut test artık yanlıştır ve silinir**: `'installer script asks before deleting data, defaults to yes and skips updates and silent runs'` (soru kalkıyor) ve `'data question warns that a server machine loses every account and message'` (o metin kalkıyor). `${isUpdated}` ve `${Silent}` korumalarını sınayan iddialar aşağıdaki yeni testlerde karşılanır. Yerlerine:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && node --test test/installer.test.js`
Expected: FAIL — `MB_YESNO` hâlâ var, `Rename` ve kurulum metni yok.

- [ ] **Step 3: `customInstall` içine kurulum metnini ekle**

Mevcut güvenlik duvarı satırlarından sonra, `${IfNot} ${Silent}` koruması altında tek bir `MessageBox MB_OK|MB_ICONINFORMATION`. Metin tasarım belgesi §7.5'teki kurulum metnidir.

- [ ] **Step 4: `customUnInstall` içindeki veri sorusunu silme mantığıyla değiştir**

Mevcut `MessageBox MB_YESNO…` bloğu tamamen kaldırılır. Yerine, `${IfNot} ${isUpdated}` koruması altında:

```nsis
  SetShellVarContext current
  ClearErrors
  IfFileExists "$APPDATA\ipchat-desktop\server-data\*.*" 0 ipchat_client
    ; Sunucu: veriyi gecici yere tasi, geri kalani sil, geri koy
    Rename "$APPDATA\ipchat-desktop\server-data" "$APPDATA\ipchat-server-data-tmp"
    IfErrors ipchat_keep_all
    RMDir /r "$APPDATA\ipchat-desktop"
    CreateDirectory "$APPDATA\ipchat-desktop"
    Rename "$APPDATA\ipchat-server-data-tmp" "$APPDATA\ipchat-desktop\server-data"
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONINFORMATION "<sunucu metni>"
    ${EndIf}
    Goto ipchat_done
  ipchat_keep_all:
    ; Tasima basarisiz: hicbir sey silme, veri kalsin
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "<tasima basarisiz metni>"
    ${EndIf}
    Goto ipchat_done
  ipchat_client:
    RMDir /r "$APPDATA\ipchat-desktop"
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONINFORMATION "<istemci metni>"
    ${EndIf}
  ipchat_done:
  SetShellVarContext all
```

`<…metni>` yerlerine tasarım belgesi §7.5'teki metinler yazılır. Taşıma başarısız metni: `Ipchat kaldırıldı. Hesaplar ve mesaj geçmişi silinmedi; %APPDATA%\ipchat-desktop klasörü olduğu gibi duruyor.`

Bu blok `taskkill` satırından **sonra** gelmelidir.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w desktop`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/build/installer.nsh desktop/test/installer.test.js
git commit -m "feat(masaustu): Windows kaldirmasi iz birakmasin, sunucu verisi korunsun"
```

---

### Task 3: Mac kaldırma akışı ve ilk açılış bildirimi

Bu görevin karar mantığı Görev 1'de test edildi; buradaki iş bağlantıdır. `main.js` Electron'a bağlı olduğu için otomatik testi yoktur (deponun her `desktop/test/*` dosyası saf modül sınar); doğrulama `npm test -w desktop` ve `node --check` ile yapılır.

**Files:**
- Modify: `desktop/src/main.js` (`uninstallEverything`, uygulama açılışı)

**Interfaces:**
- Consumes: Görev 1 → `INSTALL_NOTICE`, `uninstallConfirm`, `purgeArgs`, `shouldShowInstallNotice`; mevcut `loadConfig`/`saveConfig`.

- [ ] **Step 1: Onay penceresini `uninstallConfirm` ile kur**

`checkboxLabel` ve `checkboxChecked` kaldırılır. Sunucu tespiti dosya sistemine bakar, `serverHost` değişkenine değil — sunucu modu kapalıyken de veri durabilir. Tespit `hasServerData(…)` ile yapılır; dizin listesi `fs.readdirSync(path.join(configDir(), 'server-data'))` ile alınır, hata durumunda `null` geçilir. Yol, metinde gösterilmek üzere `uninstallConfirm`'e verilir.

- [ ] **Step 2: Silmeyi `purgeArgs` ile yap**

`checkboxChecked` koşulu kalkar; silme **her zaman** yapılır. `spawn('/bin/sh', purgeArgs(app.getPath('userData'), hasServerData), { detached: true, stdio: 'ignore' }).unref()`.

- [ ] **Step 3: İlk açılış bildirimini göster**

`app.whenReady()` içinde, mevcut `autostartInitialized` bloğunun yanında: `process.platform === 'darwin' && app.isPackaged && shouldShowInstallNotice(config)` ise `dialog.showMessageBox` ile `INSTALL_NOTICE` gösterilir ve `saveConfig(configDir(), { ...config, installNoticeShown: true })` yazılır. Ayar yazılamazsa uygulama açılmaya devam eder (mevcut `saveConfig` çağrılarındaki gibi hata yutulur).

- [ ] **Step 4: Verify**

Run: `npm test -w desktop && node --check desktop/src/main.js`
Expected: PASS ve sözdizimi temiz.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main.js
git commit -m "feat(masaustu): Mac kaldirmasi sormadan temizler, ilk acilista bilgilendirir"
```

---

### Task 4: Belgeler

**Files:**
- Modify: `README.md` ("Kaldırma ve veri" bölümü)
- Modify: `CLAUDE.md` (NSIS tuzağı ve güncel durum)
- Modify: `desktop/package.json` (`version`)

- [ ] **Step 1: README'nin kaldırma bölümünü yeni davranışa göre yaz**

Soru sorulmadığı, istemcide hiçbir iz kalmadığı, sunucuda hesap ve mesaj geçmişinin korunduğu ve nerede durduğu yazılır. Windows'taki "standart kullanıcı başka yöneticiyle yükseltirse" bilinen sınırı korunur.

- [ ] **Step 2: CLAUDE.md'yi güncelle**

"Bilinen tuzaklar" içindeki NSIS maddesine: veri sorusunun kaldırıldığı, `server-data`'nın taşı-sil-geri koy yöntemiyle korunduğu ve bunun **yalnızca gerçek Windows'ta doğrulanabileceği** eklenir. "Güncel durum"a 0.5.0 satırı eklenir; Mac tarafının denenmediği yazılır.

- [ ] **Step 3: Sürümü artır**

`desktop/package.json`: `0.4.0` → `0.5.0`.

- [ ] **Step 4: Verify**

Run: `npm test -w server && npm test -w web && npm test -w desktop && npm run build`
Expected: Hepsi PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md desktop/package.json
git commit -m "chore: surum 0.5.0, temiz kaldirma belgelendi"
```
