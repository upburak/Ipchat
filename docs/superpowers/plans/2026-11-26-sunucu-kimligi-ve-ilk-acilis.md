# Sunucu Kimliği ve İlk Açılış Onayı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 0.6.0'da iki özellik birlikte çıkar: (1) masaüstü uygulaması bağlandığı sunucunun kimliğini (Ed25519 imzası) her bağlanışta doğrular ve değişirse bir kez sorar; (2) ilk açılışta risk metni ve kaldırma kuralı iki ayrı onayla gösterilir, onaysız hiçbir şey çalışmaz.

**Architecture:** Sunucu `server-data` içinde anahtar çifti tutar ve `GET /api/identity?nonce=` ile imza atar. Masaüstünde saf modüller (`identity.js`, `verify-server.js`, `identity-store.js`, `connect-policy.js`, `welcome.js`) kararı verir ve test edilir; `main.js`, `preload.cjs`, `connect.html`, `welcome.html` yalnızca bunları bağlar. Electron'a bağlı kısımlar otomatik testle kapsanmaz; HTML sayfaları Playwright ile sahte `window.ipchat` üzerinden ölçülür.

**Tech Stack:** Node.js >= 22.5, `node:crypto` (yeni bağımlılık yok), `node:test`, Express, Electron 45.3.2 (kesin sürüm), düz HTML.

**Spec:** `docs/superpowers/specs/2026-11-26-sunucu-kimligi-design.md` ve `docs/superpowers/specs/2026-11-26-ilk-acilis-onayi-design.md`. Yürütücü ikisini de okur; ekran metinleri orada tam yazılıdır ve **kelimesi kelimesine** kopyalanır.

## Global Constraints

- Yeni bağımlılık ve yeni test kütüphanesi yok; testler `node:test`. `node:crypto` dışında kripto kütüphanesi yok.
- Arayüz metinleri, commit mesajları, belgeler Türkçe. Test adları mevcut dosyalardaki gibi İngilizce olabilir.
- Anahtar: **Ed25519**. İmzalanan mesaj: `"ipchat-kimlik-v1:" + nonce`. Nonce: 32 bayt, **64 küçük harfli hex**. Parmak izi: açık anahtarın (SPKI DER) **SHA-256** özeti, küçük harfli hex. Kullanıcıya gösterim: ilk 12 hex karakter, büyük harf, 4'lü gruplar, tire ile (`A1B2-C3D4-E5F6`).
- Anahtar dosyaları sunucunun veri klasöründedir (`IPCHAT_DATA_DIR`): `identity.key` (PKCS8 PEM, gizli) ve `identity.pub` (tek satır base64 SPKI DER). Mevcut bir anahtar **asla** sessizce yeniden üretilmez.
- Ayar dosyasında hatırlanan kimlik: `config.json` içinde `serverIdentity: { fingerprint, publicKey }`. Tek yuva.
- Kimlik değişim ekranının varsayılan düğmesi **Vazgeç**. İlk açılış onay ekranında iki kutu başta işaretsiz, "Devam et" ikisi işaretlenene kadar pasif, "Çık" yalnızca kapatır.
- Düğmeler ≥32px, `connect.html` stiliyle uyumlu (mevcut `--muted`/`--danger` değerleri CSS'te zaten var).
- Her commit mesajı, dispatch notunda verilen `Co-Authored-By` satırlarıyla biter. **Amend, rebase, reset yok.** Her görev kendi commit'ini atar.
- Gizli bilgi, parola, hesap verisi commit'e girmez; repo herkese açık.

## Review Focus

Spec'in ima ettiği ama görevlerin gövdesinde açıkça sorulmayan, en çok ısırma ihtimali olan beş durum. Her birinin testi ilgili görevde yazılıdır.

1. **Bozuk anahtar dosyası**: sunucu sessizce yeni anahtar üretirse herkes uyarı görür ve koruma anlamsızlaşır → hata verip durmalı (Task 1).
2. **Eski imzanın tekrar oynatılması**: bir nonce için alınmış imza başka nonce'ta geçmemeli (Task 3).
3. **Kimlik ucu olmayan her sunucu "eski Ipchat" sayılmamalı**: rastgele bir web sunucusu 404 verir; Ipchat değilse "ulaşılamıyor" olmalı, "desteklenmiyor" değil (Task 4).
4. **Bozuk ya da çok büyük yanıt**: JSON olmayan, devasa ya da asılı kalan bir yanıt çökertmemeli, takılı bırakmamalı → "geçersiz" (Task 4).
5. **Adres başka bilgisayara geçmiş (DHCP)**: kayıtlı adres farklı kimlikle yanıt veriyor ama gerçek sunucu başka adreste → uyarı çıkmadan gerçeğine bağlanmalı (Task 6).

---

### Task 1: Sunucu kimlik modülü

**Files:**
- Create: `server/src/identity.js`
- Test: `server/test/identity.test.js`

**Interfaces:**
- Produces:
  - `export class IdentityError extends Error`
  - `export const IDENTITY_PREFIX = 'ipchat-kimlik-v1:'`, `KEY_FILE = 'identity.key'`, `PUB_FILE = 'identity.pub'`
  - `export function fingerprintOf(publicKeyB64: string): string`
  - `export function loadOrCreateIdentity(dir: string): { publicKey: string, fingerprint: string, sign(nonce: string): string }` — `sign` base64 imza döner.
- Bu dosya **hiçbir yan etkili import içermez** (`db.js` yok): masaüstü testleri bunu doğrudan içe aktarır (Task 3).

- [ ] **Step 1: Write the failing tests** (`server/test/identity.test.js`, her test geçici klasörle):
  - `creates key and pub files on first run`: boş klasörde çağır; `identity.key` ve `identity.pub` oluşur; `publicKey` pub dosyasının içeriğine eşit; `fingerprint` 64 hex.
  - `returns the same identity on the second run`: iki çağrı aynı `publicKey` ve `fingerprint`.
  - `signature verifies with node:crypto against the public key`: `crypto.verify(null, Buffer.from('ipchat-kimlik-v1:' + nonce), publicKeyObject, Buffer.from(sig,'base64'))` true.
  - `signature for one nonce does not verify for another`.
  - `rewrites a missing pub file from the key`: yalnızca `identity.pub` silinir; çağrı aynı kimliği döner ve dosyayı geri yazar.
  - `throws IdentityError and touches nothing when the key file is corrupt`: `identity.key` içine `'çöp'` yaz; çağrı `IdentityError` fırlatır; dosya içeriği **değişmemiştir** ve yeni anahtar üretilmemiştir.
  - `throws IdentityError when only the pub file exists`: key yok, pub var → `IdentityError`, `identity.key` oluşturulmamıştır.
- [ ] **Step 2: Run to verify failure** — `npm test -w server -- test/identity.test.js` (veya `node --test server/test/identity.test.js`). Expected: FAIL, modül yok.
- [ ] **Step 3: Implement `server/src/identity.js`** — Üretimde `crypto.generateKeyPairSync('ed25519')`; gizli anahtarı `flag: 'wx', mode: 0o600` ile yaz (üzerine yazma yok), sonra pub'u yaz. Kural: iki dosya da yok → üret; key var ve çözülüyor → pub'u türet, eksik/farklıysa yeniden yaz; key var ama çözülmüyor → `IdentityError`; yalnızca pub var → `IdentityError`.
- [ ] **Step 4: Run to verify pass** — aynı komut, hepsi PASS; sonra `npm test -w server` (mevcut takım bozulmadı).
- [ ] **Step 5: Commit** — `feat(sunucu): kimlik anahtari uretimi ve imza (bozuk anahtarda durur)`

---

### Task 2: Kimlik ucu, sunucu açılışı ve keşif yanıtı

**Files:**
- Create: `server/src/routes/identity.js`
- Modify: `server/src/db.js` (yalnızca `dataDir`'i dışa aç: `export const dataDir`), `server/src/index.js`, `server/src/discovery.js`
- Test: `server/test/identity-route.test.js`, `server/test/discovery.test.js` (mevcut dosyaya ekle)

**Interfaces:**
- Consumes: Task 1 `loadOrCreateIdentity`, `Identity`.
- Produces:
  - `export function createIdentityRouter(identity): express.Router` — `GET /identity?nonce=<64 hex>` → `200 { app: 'ipchat', publicKey, fingerprint, signature }`; geçersiz/eksik nonce → `400 { error: 'Geçersiz sınama değeri' }`.
  - `startDiscovery(httpPort, { udpPort, name, fingerprint? })`: `fingerprint` verilirse yanıt `{ app, port, name, fingerprint }`, verilmezse **eski biçim aynen** (`{ app, port, name }`).

- [ ] **Step 1: Write the failing tests**
  - `identity-route.test.js`: kendi `express()` uygulamasında yönlendiriciyi `/api`'ye bağla, ephemeral portta `http` sunucusu aç, `fetch` ile: `serves a verifiable identity for a valid nonce` (imzayı `node:crypto` ile doğrula, `fingerprint` `fingerprintOf(publicKey)` ile aynı); `rejects a missing nonce with 400`; `rejects a nonce that is not 64 lowercase hex with 400`; `different nonces give different signatures`.
  - `discovery.test.js`: `includes the fingerprint in the reply when given` (`{ app, port, name, fingerprint }` deepEqual); mevcut `answers IPCHAT_DISCOVER with app, port and name` testi **değişmeden** geçer.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** — yönlendirici; `discovery.js`'de yanıt nesnesine `fingerprint`'i yalnızca verilmişse ekle; `index.js`'de `listen`'den **önce** `loadOrCreateIdentity(dataDir)` çağır, `IdentityError` ya da başka hatada `console.error('Hata: sunucu kimliği okunamadı, sunucu başlatılmıyor: ' + mesaj)` yazıp `process.exit(1)`; yönlendiriciyi `app.use('/api', createIdentityRouter(identity))` ile bağla; `startDiscovery(Number(PORT), { fingerprint: identity.fingerprint })`. `/api/health` değişmez.
- [ ] **Step 4: Run to verify pass** — `npm test -w server` tamamı.
- [ ] **Step 5: Commit** — `feat(sunucu): GET /api/identity, acilista kimlik yukleme, kesif yanitinda parmak izi`

---

### Task 3: Masaüstü kimlik doğrulayıcı (saf mantık)

**Files:**
- Create: `desktop/src/identity.js`
- Test: `desktop/test/identity.test.js`

**Interfaces:**
- Produces (hiçbiri hata fırlatmaz, `node:crypto` dışında import yok):
  - `export const IDENTITY_PREFIX = 'ipchat-kimlik-v1:'`
  - `export function makeNonce(): string` (64 hex)
  - `export function fingerprintOf(publicKeyB64: string): string`
  - `export function shortFingerprint(fp: string): string` → `A1B2-C3D4-E5F6`
  - `export function verifyIdentityReply(reply: unknown, nonce: string): { ok: true, publicKey: string, fingerprint: string } | { ok: false }`

- [ ] **Step 1: Write the failing tests** — gerçek sunucu modülünü `../../server/src/identity.js`'den içe aktar (uyumluluk kanıtı):
  - `prefix matches the server's prefix`.
  - `accepts a real signed reply from the server module` (geçici klasörde `loadOrCreateIdentity`, `makeNonce()`, yanıt = `{ app:'ipchat', publicKey, fingerprint, signature: identity.sign(nonce) }`).
  - `fingerprintOf equals the server's fingerprint`; `shortFingerprint` biçimi (`/^[0-9A-F]{4}(-[0-9A-F]{4}){2}$/`, giriş büyük/küçük fark etmez).
  - `rejects a signature made for a different nonce` (**tekrar oynatma**, Review Focus 2).
  - `rejects a reply whose fingerprint field does not match its key`.
  - `rejects wrong app, missing fields, non-string fields, a non-base64 key, a non-ed25519 key` (RSA SPKI ile), `an oversized key or signature (>200 chars)`; hiçbiri hata fırlatmaz.
  - `makeNonce gives 64 lowercase hex and is different each time`.
- [ ] **Step 2: Run to verify failure** — `node --test desktop/test/identity.test.js`.
- [ ] **Step 3: Implement** — `verifyIdentityReply`: önce şekil/uzunluk denetimi, sonra `crypto.createPublicKey({ key: Buffer.from(b64,'base64'), format:'der', type:'spki' })`, `asymmetricKeyType === 'ed25519'`, `crypto.verify(null, Buffer.from(IDENTITY_PREFIX + nonce), key, Buffer.from(sig,'base64'))`; tüm yol `try/catch` içinde `{ ok:false }`.
- [ ] **Step 4: Run to verify pass**, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): sunucu kimligi dogrulayici (imza, parmak izi, nonce)`

---

### Task 4: `verifyServer` (ağdan doğrulama)

**Files:**
- Create: `desktop/src/verify-server.js`
- Test: `desktop/test/verify-server.test.js`

**Interfaces:**
- Consumes: Task 3 (`makeNonce`, `verifyIdentityReply`, `fingerprintOf`).
- Produces:
  ```
  export async function verifyServer(url: string, pinned: {fingerprint, publicKey} | undefined,
    opts?: { fetchImpl?: typeof fetch, nonce?: string, timeoutMs?: number /*1500*/ }):
    Promise<{ state: 'known'|'new'|'changed'|'unsupported'|'invalid'|'unreachable',
              identity?: { publicKey: string, fingerprint: string }, legacy?: true }>
  ```
  Kurallar: `GET ${url}/api/identity?nonce=<nonce>`; **200** + geçerli imza → pin yoksa `new`, parmak izi eşitse `known`, değilse `changed` (hepsinde `identity` var); **200** ama JSON/imza geçersiz ya da yanıt gövdesi **4 KB**'ı aşıyor (akışı o noktada kes) → `invalid`; **404** → `${url}/api/health` `{app:'ipchat'}` diyorsa eski sunucu: pin yoksa `{ state:'unsupported' }`, pin varsa `{ state:'changed', legacy:true }`; health Ipchat değilse `unreachable` (Review Focus 3); diğer her durum kodu, ağ hatası, zaman aşımı → `unreachable`; **400** → `invalid`.

- [ ] **Step 1: Write the failing tests** — gerçek `node:http` sunucusu (ephemeral port) ve gerçek `loadOrCreateIdentity`; her durum için küçük bir davranış sunucusu:
  - `known when the fingerprint matches the pin`, `new when nothing is pinned`, `changed when a different identity is pinned` (ikinci kimlik başka klasörde üretilir).
  - `legacy server without the endpoint is unsupported when nothing is pinned` ve `...is changed with legacy=true when something is pinned` (sunucu `/api/identity` için 404, `/api/health` için `{ok:true,app:'ipchat'}`).
  - `a non-ipchat web server that answers 404 is unreachable, not unsupported` (health `{app:'x'}` ya da 404).
  - `a reply signed for another nonce is invalid` (sunucu sabit eski bir yanıtı tekrar eder).
  - `non-json body is invalid`, `a 1 MB body is invalid and does not hang` (Review Focus 4), `a server that never answers is unreachable within the timeout` (`timeoutMs: 200`), `connection refused is unreachable`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** — `AbortSignal.timeout`; gövdeyi `res.body` okuyucusuyla sınırlı oku (4096 bayt aşılırsa iptal et); `fetchImpl` ve `nonce` enjekte edilebilir.
- [ ] **Step 4: Run to verify pass**, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): verifyServer (kimlik sorgusu, eski sunucu ayrimi, sinirli yanit)`

---

### Task 5: Kimlik deposu ve bağlanma kararı (saf mantık)

**Files:**
- Create: `desktop/src/identity-store.js`, `desktop/src/connect-policy.js`
- Test: `desktop/test/identity-store.test.js`, `desktop/test/connect-policy.test.js`

**Interfaces:**
- Consumes: Task 3 (`fingerprintOf`, `shortFingerprint`); Task 4'ün sonuç biçimi (`VerifyResult`).
- Produces:
  - `getPinned(config): { fingerprint, publicKey } | undefined` — biçim bozuksa ya da `fingerprint !== fingerprintOf(publicKey)` ise `undefined`.
  - `withConnection(config, url: string, identity?: {publicKey, fingerprint} | null): object` — yeni ayar nesnesi: `lastServer = url`; `identity` nesne → `serverIdentity` onunla değişir; `null` → `serverIdentity` silinir; `undefined` → dokunulmaz. Girdiyi değiştirmez.
  - `withoutServer(config): object` — `lastServer` ve `serverIdentity` yok.
  - `readLocalIdentity(serverDataDir: string): { publicKey, fingerprint } | null` — `identity.pub`'ı okur; yok/bozuksa `null`.
  - `connectAction(result: VerifyResult)`: `known|new` → `{ action:'open', identity }`; `unsupported` → `{ action:'open' }` (kimlik anahtarı **yok**); `changed` → `{ action:'confirm', info:{ fingerprint: string /* kısa, legacy ise '' */, legacy: boolean } }`; `invalid` → `{ action:'error', message:'Bu sunucunun kimliği doğrulanamadı' }`; `unreachable` → `{ action:'error', message:'Bu adreste Ipchat sunucusu bulunamadı' }`.
  - `confirmAction(result: VerifyResult, shown: string)`: kullanıcının onayladığı kısa parmak izine (`shown`, legacy için `''`) **hâlâ** uyuyorsa `{ action:'open', identity }` (legacy → `identity: null`); uymuyorsa `{ action:'error', message:'Sunucu kimliği az önce değişti. Yeniden dene.' }`.
  - `ownServerAction(result: VerifyResult)`: yalnızca `known` → `{ action:'open', identity }`, aksi hâlde `{ action:'fail' }`.

- [ ] **Step 1: Write the failing tests** — `identity-store`: `getPinned` geçerli/boş/bozuk/uyumsuz parmak izi; `withConnection` üç durum (nesne, `null`, `undefined`) ve girdiyi değiştirmemesi; `withoutServer`; `readLocalIdentity` geçici klasörle (gerçek `server` modülüyle üretilmiş `identity.pub`, eksik dosya, çöp içerik). `connect-policy`: her `state` için beklenen eylem; `confirmAction`: aynı parmak izi → open; **kullanıcının gördüğünden farklı kimlik** → error (Review Focus: onay ile bağlanma arasında kimlik değişirse bağlanma); legacy onay (`shown === ''`, sonuç `legacy:true`) → `identity:null`; `shown === ''` ama sonuç kimlikli → error; `ownServerAction` yalnızca `known`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** both modules (ikisi de yalnızca `node:fs`, `node:path` ve Task 3 ile).
- [ ] **Step 4: Run to verify pass**, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): kimlik deposu ve baglanma karar mantigi`

---

### Task 6: `resolveServer` kimlik farkındalığı

**Files:**
- Modify: `desktop/src/resolve-server.js`, `desktop/src/server-guard.js` (`networkServerKnown`)
- Test: `desktop/test/resolve-server.test.js` (yeniden yaz), `desktop/test/server-guard.test.js` (ekle)

**Interfaces:**
- Consumes: Task 4 `verifyServer`, Task 5 `getPinned`, `shortFingerprint`.
- Produces: `resolveServer({ configDir, discover = discoverServers, verify = verifyServer })` (eski `reachable` parametresi **kalkar**; `isReachable` dışa açık kalır, Task 7'ye kadar `main.js` kullanır). Dönüş:
  - `{ status:'ok', url, identity? }`
  - `{ status:'changed', url, name: string, fingerprint: string /*kısa, legacy ise ''*/, legacy: boolean }`
  - `{ status:'choose', servers: Array<{ url, name, unfamiliar?: true }> }`
  - `{ status:'manual' }`

  Kurallar (sırayla): (1) `pinned = getPinned(config)`; kayıtlı adres varsa doğrula: `known` → `ok` (kimlikle); `new` → `ok` (kimlikle); `unsupported` → `ok` (kimliksiz); `changed` → adayı sakla, **keşfe devam et**; `unreachable|invalid` → keşfe devam et. (2) `discover()` **en çok bir kez**; kayıtlı adres dışındaki adayları paralel doğrula. (3) Adaylardan biri `known` ise → `ok` (o adres, kimlikle; kayıtlı adres de `known` ise ilk adım zaten döndü). (4) Pin **varsa**: tanınmayanlar = (kayıtlı adres `changed` ise o) ∪ (keşfedilen `changed` adaylar); **tek** tane → `changed`; birden çok → `choose` (hepsi `unfamiliar:true`). (5) Pin **yoksa**: `new|unsupported` adaylar → `choose` (tek de olsa, mevcut davranış); `invalid|unreachable` düşer. (6) Hiçbiri → `manual`. Hiçbir durumda `lastServer`/`serverIdentity` yazılmaz (yazmayı `main.js` yapar). `changed` sonucunun `name`'i keşif listesindeki ad, yoksa ana makine adı.
  - `networkServerKnown`: `status === 'changed'` için de adres döngü-geri değilse `true`.

- [ ] **Step 1: Write the failing tests** — `verify` sahte (adres → `VerifyResult` tablosu), `discover` sahte:
  - Mevcut altı testin eşdeğerleri `verify` ile (kayıtlı sunucu `known` → keşif çağrılmaz; tek yeni sunucu `choose`, ayar yazılmaz; ulaşılamayanlar düşer; birden çok bilinmeyen `choose`; hiçbiri `manual`; keşif en çok bir kez).
  - `address reused by a different server: remembered address changed but the pinned identity is found elsewhere → ok on the new address, no warning` (Review Focus 5).
  - `remembered address changed and nothing else found → changed with the discovered name`.
  - `pinned, one unknown server discovered → changed`; `pinned, two unknown → choose with unfamiliar flags`.
  - `legacy server with a pin → changed with legacy true and empty fingerprint`.
  - `unpinned and unsupported server → ok without identity`.
  - `invalid reply at the remembered address is never connected`.
  - `server-guard`: `changed` ile `networkServerKnown` true (uzak adres), döngü-geri adres false.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** yukarıdaki sıra.
- [ ] **Step 4: Run to verify pass**, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): sunucu secimi kimlik dogrular, adres degisimi uyari uretmez`

---

### Task 7: Kimlik bağlantısı (`main.js`, `preload.cjs`, `connect.html`)

**Files:**
- Modify: `desktop/src/main.js`, `desktop/src/preload.cjs`, `desktop/src/connect.html`

**Interfaces:**
- Consumes: Task 4–6 (`verifyServer`, `getPinned`, `withConnection`, `withoutServer`, `readLocalIdentity`, `connectAction`, `confirmAction`, `ownServerAction`, yeni `resolveServer` sonuçları).
- Produces (IPC): `server:submit(text)` → `{ ok } | { error } | { confirm: { url, name, fingerprint, legacy } }`; **yeni** `server:confirm(url, fingerprint)` → `{ ok } | { error }` (ikisi de `isTrustedSender` arkasında); `window.ipchat.confirmServer(url, fingerprint)`.

Bu görev Electron'a bağlıdır: **otomatik test yok.** Doğrulama Step 4'teki ölçümlerle yapılır.

- [ ] **Step 1: `main.js`**
  - `server:submit`: `normalizeServerUrl` → `verifyServer(url, getPinned(config))` → `connectAction`. `open` → `saveConfig(withConnection(config, url, action.identity))` (hata yutulur) ve `openServer(url)`; `confirm` → `{ confirm: { url, name: serverLabelFor(url), ...info } }` döndür (bağlanma/yazma **yok**); `error` → `{ error }`. Eski `isReachable` çağrısı kalkar.
  - Yeni `server:confirm`: aynı doğrulama, sonra `confirmAction(result, shown)`; `open` → `withConnection(config, url, action.identity)` kaydet (legacy'de `null` = eski kimlik silinir) ve `openServer`.
  - `connectToServer`: `result.status === 'ok'` → `openServer`'dan önce `withConnection(config, result.url, result.identity)` kaydet; `changed` → `showConnectPage('changed', [], { url, name, fingerprint, legacy })`; `choose` mevcut gibi (sunucu listesi `unfamiliar` bayraklarını taşır). `retryInBackground` yalnızca `ok`'u işler (değişmedi).
  - Kendi sunucusu (`serverMode` açılışı ve `enableServerMode`): `hostServer()` sonrası `own = readLocalIdentity(<configDir>/server-data)`; `own` yoksa ya da `ownServerAction(await verifyServer('http://127.0.0.1:3000', own))` `fail` ise `showConnectPage('manual')` (**bağlanma**); `open` ise `withConnection(config, localUrl, identity)` kaydet, `openServer`.
  - `disableServerMode`: `saveConfig({ ...withoutServer(config), serverMode:false })` (`serverIdentity` de gider).
  - `showConnectPage(mode, servers = [], extra)`: `extra` varsa `query.changed = JSON.stringify(extra)`.
- [ ] **Step 2: `preload.cjs`** — `confirmServer: (url, fingerprint) => ipcRenderer.invoke('server:confirm', url, fingerprint)`.
- [ ] **Step 3: `connect.html`** — Yeni `#changed` görünümü (spec `sunucu-kimligi-design.md` §7.4 ve §7.9.5 metinleri **aynen**; legacy için "Bu sunucu kimlik bilgisi vermiyor (eski sürüm olabilir)" varyantı; bilgisayar adı, adres ve (legacy değilse) kısa parmak izi gösterilir). `mode=changed` sayfa açılışında ya da `submit` sonucu `{ confirm }` ile açılır. Düğmeler: **Vazgeç** (varsayılan odak; `#changed`'ı gizleyip elle adres görünümüne döner) ve **Bağlan ve yeni sunucuyu hatırla** (`window.ipchat.confirmServer`; hata satırında gösterilir). Seçim listesinde `unfamiliar` olan sunucunun yanına "tanımadığın sunucu" etiketi. Çift tıklamaya karşı mevcut `busy` koruması kullanılır.
- [ ] **Step 4: Ölç (Playwright, sahte `window.ipchat`)** — `/opt/node-tools/node_modules/playwright/index.js` (CommonJS: `import pw from '…'; const { chromium } = pw;`). `file://…/connect.html?mode=changed&changed=…` ile: (a) `deviceScaleFactor` 1'de 800x620 pencerede metnin kesilmediğini ve iki düğmenin ≥32px olduğunu ölç; (b) odaklı düğmenin **Vazgeç** olduğunu; (c) "Bağlan…" tıklanınca sahte `confirmServer`'ın doğru `(url, fingerprint)` ile **bir kez** çağrıldığını (çift tıklama dahil); (d) `legacy` varyantı metnini; (e) `mode=choose` ile `unfamiliar` etiketini. Ekran görüntülerini scratchpad'e kaydet. Ayrıca `node --check desktop/src/main.js` ve `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): sunucu kimligi bagla (dogrulama, degisim ekrani, kendi sunucu, sunucu modu kapaninca unut)`

---

### Task 8: İlk açılış mantığı ve kaldırma metni

**Files:**
- Create: `desktop/src/welcome.js`
- Modify: `desktop/src/cleanup.js` (`removalRule` ekle; **`INSTALL_NOTICE` ve `shouldShowInstallNotice` bu görevde KALIR**, Task 9 kaldırır)
- Test: `desktop/test/welcome.test.js`, `desktop/test/cleanup.test.js` (ekle)

**Interfaces:**
- Produces:
  - `export const WELCOME_VERSION = 1`
  - `export function needsWelcome(config: unknown, isPackaged: boolean): boolean` — paketli değilse `false`; `config?.welcomeAccepted?.version` sayı değilse ya da `< WELCOME_VERSION` ise `true`; config `null`/dizi/bozuksa `true`.
  - `export function welcomeRecord(now: Date): { version: number, at: string }` (`at` = ISO).
  - `cleanup.js`: `export function removalRule(platform: string): string` — `'darwin'`: spec `ilk-acilis-onayi-design.md` §7.1/§7.4.1 Mac metni (kaldırma kuralı + tepsi menüsü ve Çöp Kutusu cümlesi); diğer her değer: Windows metni ("…program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir. Bu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur.").

- [ ] **Step 1: Write the failing tests**
  - `needsWelcome`: kayıt yok → true; `{welcomeAccepted:{version:1}}` → false; `version: 0` → true; `version: '1'` (yazı) → true; paketli değil → false (kayıt olmasa da); `null`, `[]`, `'x'` config → true (paketliyse) — **bozuk ayar onay sayılmaz**; ileri sürüm (`version: 2`) → false.
  - `welcomeRecord` ISO tarihi ve sürümü.
  - `removalRule('darwin')` "tepsi" ve "Çöp Kutusu" içerir ve "güvenlik duvarı" **içermez**; `removalRule('win32')` "güvenlik duvarı kuralları" içerir ve "Çöp Kutusu" **içermez**; ikisi de sunucu verisinin korunduğunu söyler; bilinmeyen platform Windows metnini verir.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify pass**, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): ilk acilis onayi karar mantigi ve platforma gore kaldirma metni`

---

### Task 9: İlk açılış kapısı ve ekranı (`welcome.html`, `main.js`, `preload.cjs`)

**Files:**
- Create: `desktop/src/welcome.html`
- Modify: `desktop/src/main.js`, `desktop/src/preload.cjs`, `desktop/src/cleanup.js` (`INSTALL_NOTICE`, `shouldShowInstallNotice` **sil**), `desktop/test/cleanup.test.js` (silinenlerin testlerini kaldır)

**Interfaces:**
- Consumes: Task 8 (`needsWelcome`, `welcomeRecord`, `removalRule`).
- Produces (IPC, hepsi `welcome.html` göndericisine kilitli): `welcome:text` → `{ removal: string }`; `welcome:accept` → `{ ok: true }`; `welcome:quit` → uygulamayı kapatır. `window.ipchat.getWelcomeText()`, `acceptWelcome()`, `quitApp()`.

Elektron'a bağlı: otomatik test yok; Step 4'te ölçülür.

- [ ] **Step 1: `welcome.html`** — Başlık ve metin `ilk-acilis-onayi-design.md` §7.1'den **kelimesi kelimesine**; kaldırma kuralı `getWelcomeText().removal`'dan (`\n\n` paragraf ayracı). Metin alanı kaydırılabilir; **iki onay kutusu ve iki düğme kaydırma alanının dışında, altta sabit** (§9). Kutu 1: "Yukarıdaki sınırları okudum, anladım." Kutu 2: "Kaldırma kuralını okudum, anladım." İkisi başta işaretsiz; **Devam et** ikisi işaretlenene kadar `disabled`; **Çık** her zaman açık. Etiket tıklanınca kutu değişir; klavyeyle gezilebilir. Çift tıklamaya karşı `busy` koruması.
- [ ] **Step 2: `main.js` kapısı** — `whenReady`: `config = loadConfig`; `needsWelcome(config, app.isPackaged)` ise `welcomePending = true`, **yalnızca pencere** oluştur ve `welcome.html` yükle; **yapılmayacaklar** (onaydan önce): `connectToServer`/keşif, sunucu modunu başlatma, `setLoginItemSettings`, `createTray`, Windows kalıntı bildirimi. Onay yoksa pencerenin kapatma düğmesi **uygulamayı kapatır** (`quitting = true; app.quit()`), tepsiye indirmez. `welcome:accept`: `saveConfig({ ...config, welcomeAccepted: welcomeRecord(new Date()) })` (**hata yutulur, uygulama bu oturum için devam eder**), `welcomePending = false`, sonra bugünkü açılış sırası: otomatik başlatma ilk kayıt (`autostartInitialized` mantığı aynen), Windows kalıntı bildirimi, `createTray`, `connectToServer()`. Mac `INSTALL_NOTICE` bloğu (`darwin` `dialog.showMessageBox`) ve `installNoticeShown` yazımı **kaldırılır**. `createWindow`'un sonundaki `connectToServer()` çağrısı kapıya göre koşullanır. Gönderici denetimi: `isTrustedSender(url, welcomeFileUrl)`.
- [ ] **Step 3: `preload.cjs`** — üç yeni köprü.
- [ ] **Step 4: Ölç (Playwright, sahte `window.ipchat`)** — 800x620'de: (a) açılışta "Devam et" pasif; yalnızca kutu 1 → hâlâ pasif; yalnızca kutu 2 → hâlâ pasif; ikisi → aktif; birini kaldır → tekrar pasif; (b) onay kutularının ve düğmelerin metin kaydırılınca **görünür kaldığı** (kaydırma alanı dışında) ve düğmelerin ≥32px olduğu; (c) "Devam et" çift tıklanınca `acceptWelcome` **bir kez** çağrılır; (d) "Çık" `quitApp`'i çağırır ve `acceptWelcome`'ı çağırmaz; (e) metnin kesilmediği (kaydırma yüksekliği ölçümü) ve sahte `removal` metninin sayfada göründüğü. `node --check desktop/src/main.js`, `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): ilk acilis onayi ekrani ve kapisi, Mac ilk acilis bildirimi bu ekranla birlesti`

---

### Task 10: Sürüm 0.6.0 ve belgeler

**Files:**
- Modify: `desktop/package.json` (`version`: `0.6.0`; kilit dosyasında masaüstü sürümü yazılıysa onu da tutarlı yap), `README.md`, `CLAUDE.md`, ilgili tasarım belgelerinin `Durum` satırı

- [ ] **Step 1: README** — `Kullanım`'a "İlk açılış" bölümü (ekranın ne söylediği, iki onay, Çık, güncelleme gününde **önce sunucu bilgisayarında Devam et**); `Hesaplar`/`Kullanım` yanına "Sunucu kimliği" (ne yaptığı, "bu sunucu daha önce bağlandığın sunucu değil" ekranı ne zaman çıkar, **Vazgeç** önerilir); `Yedek almak`'a: yeni bilgisayara geçerken `server-data` klasörünü taşı, **kimlik onunla gelir**, taşınmazsa herkes bir kez uyarı görür; `Sınırlar`'a: kimlik sahte sunucuyu engeller, araya girmeyi/dinlemeyi engellemez, trafik şifrelenmez; güncelleme yok (yeni sürümü elle kurulur); `Yayın` örnek etiketi `test-0.6.1`. **Sürüm geçmişi satırı bu görevde yazılmaz** (kural: `main`'e alındıktan sonra, denenip denenmediği bilinerek).
- [ ] **Step 2: CLAUDE.md** — `Güncel durum`'a "0.6.0'da kodlandı" bölümü: ne yapıldığı, **neyin otomatik testle denendiği** (saf mantık, gerçek sunucu modülüyle uyumluluk, Linux'ta Playwright ile HTML ölçümleri) ve **gerçek ortamda denenmediği** (Electron kapısı, kimlik değişim akışı gerçek ağda, kendi sunucu doğrulaması, Mac); bilinen sınırlar (kimlik doğrulama şifreleme değildir; sayfa içi yenileme/Socket.IO yeniden bağlanması yeniden doğrulanmaz; tek yuva). Yeni "Bilinen tuzaklar" maddesi: kimlik `server-data` ile aynı kaderi paylaşır, silinirse herkese uyarı çıkar. `Sıradaki işler`'den sunucu kimliğini çıkar, **trafiğin şifrelenmesi** ekle (dosya paylaşımından önce).
- [ ] **Step 3: Tüm doğrulama** — `npm test -w server && npm test -w web && npm test -w desktop && npm run build`; sayıları ve çıktıyı rapora yaz.
- [ ] **Step 4: Commit** — `chore: surum 0.6.0, sunucu kimligi ve ilk acilis onayi belgelendi`

---

## Self-Review

**Spec coverage.** Sunucu kimliği: §7.1 anahtar/parmak izi/bozuk dosya → Task 1; §7.2 akış ve beş durum → Task 3–4; §7.3 nerede doğrulanır (ana süreç, tek modül) → Task 4, 7; §7.4 değişim ekranı → Task 5, 7; §7.5 keşifte seçim → Task 6, 7; §7.6 eski sunucu/sürüm düşürme → Task 4, 6; §7.7 ve §7.9.2 kendi sunucu → Task 5 (`readLocalIdentity`, `ownServerAction`), 7; §7.8 keşif yanıtı → Task 2; §7.9.1 önce keşif → Task 6; §7.9.3 masaüstü dışı sunucular → Task 1–2 (kimlik sunucu kodunda, `dataDir`); §7.9.4 sunucu modu kapanınca unut → Task 5 (`withoutServer`), 7; §7.9.5 → Task 5, 7; §7.9.6 kapsam sınırı → Task 10'da belgelenir. İlk açılış: §7.1 metin → Task 9; §7.2 iki onay → Task 9; §7.3 kayıt/sürüm → Task 8, 9; §7.4 kapı → Task 9; §7.4.1 üç netleştirme → Task 8–9 (kaydedilemezse devam, mevcut otomatik başlatmaya dokunulmaz, platforma göre metin); §7.5 NSIS'e dokunulmaz → hiçbir görev `installer.nsh`'i değiştirmez; §9 güncelleme günü riski → Task 10 (README) ve yayın notu.

**Step scan / Type consistency.** `VerifyResult` biçimi (`state`, `identity?`, `legacy?`) Task 4'te tanımlı ve Task 5–7'de aynı adlarla kullanılıyor. `shown` her yerde kısa parmak izi (`''` = legacy). `withConnection`'ın üçlü `identity` anlamı (nesne/`null`/`undefined`) Task 5'te tanımlı, Task 7'de bu anlamla çağrılıyor. `fingerprintOf` hem sunucuda hem masaüstünde var; uyumluluk Task 3'te gerçek sunucu modülüyle sınanıyor.

**Proportion.** Plan, iki tasarım belgesinin toplamından kısa; gövde kodu yok, yalnızca imza, kural ve test adları.
