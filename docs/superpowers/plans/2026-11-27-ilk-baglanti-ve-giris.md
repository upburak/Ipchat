# İlk Bağlantı Bilgi Ekranı ve Giriş Açıklamaları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Hatırlanan sunucu yokken ağda tek sunucu bulunduğunda, bağlanmadan önce geri sayımlı bir "Sunucu bulundu" bilgi ekranı göstermek; (2) giriş, kayıt, onay bekleme ve PIN ekranlarına sade açıklamalar eklemek.

**Architecture:** `resolveServer` tek sunucuyu `autoPicked` işaretiyle döndürür; ana süreçte saf bir karar fonksiyonu (`decideFound`) bilgi ekranının gösterilip gösterilmeyeceğine karar verir; bilgi ekranı `connect.html` içinde yeni bir görünümdür ve bağlanmayı mevcut doğrulanmış yoldan (`submitServer`) yapar. Giriş açıklamaları web'de bir metin modülünden gelir.

**Tech Stack:** Node.js >= 22.5, `node:test`, Electron 45.3.2 (kesin sürüm), React + düz CSS (tema belirteçleri), Playwright (yalnızca ölçüm).

**Spec:** `docs/superpowers/specs/2026-11-27-ilk-baglanti-bilgisi-ve-giris-aciklamalari-design.md` (onaylı). Metinler orada §6.1 ve §6.2'de tam yazılıdır ve **kelimesi kelimesine** kopyalanır.

## Global Constraints

- Yeni bağımlılık ve yeni test kütüphanesi yok; testler `node:test`. Metinler Türkçe, commit mesajları Türkçe ve dispatch'te verilen `Co-Authored-By` satırlarıyla biter. **Amend, rebase, reset yok.** Repo herkese açık: gizli bilgi, gerçek kişi adı yok.
- Renk değeri yazılmaz; yalnızca tema belirteçleri (`var(--…)`). `connect.html` yalnızca **kendi blokunda tanımlı** belirteçleri kullanır; yeni belirteç gerekirse web bloğundaki değerle **birebir aynı** kopyalanır (`desktop/test/theme-sync.test.js` ve `web/test/theme-contrast.test.js` yeşil kalır).
- Bilgi ekranı bağlanmayı **kendisi yapmaz**: `submitServer(url)` mevcut yolunu kullanır (kimlik sorgusu → sabitleme → açma); güvenlik denetimleri atlanmaz. Ağdan gelen metin (sunucu adı) yalnızca `textContent` ile basılır.
- Mevcut davranış korunur: hatırlanan sunucuya bağlanan açılışlar, iki ya da daha çok sunucuda liste, tepsideki "Başka bir sunucuya bağlan…" tek girişli listesi (`autoPickSingle=false`), `changed` ekranı, 0.6.0'ın bütün güvenlik/ilk açılış mantığı.

## Review Focus

1. **Arka plan denemesi bilgi ekranını sıfırlamamalı**: 10 sn'lik `retryInBackground` aynı adres için bilgi ekranı zaten gösteriliyorsa yeniden göstermemeli (geri sayım sıfırlanır) ve "Başka bir adres yaz" denen adresi yeniden önermemeli (Task 2'nin `decideFound` testleri).
2. **Bilgi ekranı bir güvenlik kaçışı olmamalı**: otomatik bağlanma da, "Bağlan" da, yalnızca `submitServer` ile; kimlik `changed` ise bilinen "değişti" ekranı çıkar (Task 2 izi).
3. **Çift tıklama / geri sayım ile tıklama yarışı**: "Bağlan"a basıp aynı anda geri sayımın bitmesi `submitServer`'ı **bir kez** çağırmalı (Task 2 Playwright).
4. **Ağdan gelen ad**: `<img onerror>` gibi içerik metin olarak kalmalı (Task 2 Playwright).
5. **Giriş açıklamaları sunucu güncellenmeden görünmez** ve koyu temada okunur kalmalı (≥ 4.5:1; Task 3 ölçümü).

---

### Task 1: `resolveServer` tek sunucuyu işaretlesin

**Files:**
- Modify: `desktop/src/resolve-server.js`
- Test: `desktop/test/resolve-server.test.js`

**Interfaces:**
- Produces: kural 5'te (pin yok, `autoPickSingle !== false`, tam bir `new|unsupported` aday) dönüş `{ status:'ok', url, identity?, name: string, autoPicked: true }` olur (`identity` yalnızca `new` için, mevcut gibi); `name` keşif girişindeki ad, yoksa adresin ana makine adı (`nameOf` zaten var). **Diğer bütün `ok` dönüşleri** (kayıtlı adres `known|new|unsupported`, keşifte `known`) **değişmez**: `name`/`autoPicked` anahtarı **yoktur**.

- [ ] **Step 1: Write the failing tests** — mevcut tek-aday testlerinin beklentisi yeni şekle uyarlanır (`deepEqual` kullanılan yerler); eklenir: `single new candidate is flagged autoPicked and carries its name`, `single unsupported candidate is flagged autoPicked without identity key`, `name falls back to the hostname when discovery gave none`, `remembered address ok results carry neither name nor autoPicked`, `a known discovered server is not flagged autoPicked`, `autoPickSingle:false still gives choose (unchanged)`.
- [ ] **Step 2: Run to verify failure** — `node --test desktop/test/resolve-server.test.js`.
- [ ] **Step 3: Implement** (`resolve-server.js` kural 5, tek değişiklik).
- [ ] **Step 4: Run to verify pass** — hedef dosya, sonra `npm test -w desktop`.
- [ ] **Step 5: Commit** — `feat(masaustu): tek kesfedilen sunucu autoPicked ve adiyla doner`

---

### Task 2: Bilgi ekranı: karar mantığı, ana süreç, `connect.html`

**Files:**
- Create: `desktop/src/found-policy.js`, `desktop/test/found-policy.test.js`
- Modify: `desktop/src/main.js`, `desktop/src/preload.cjs`, `desktop/src/connect.html`

**Interfaces:**
- Consumes: Task 1'in `ok` sonucundaki `name` ve `autoPicked`.
- Produces: `decideFound(result, { dismissedUrl, shownUrl }) -> 'show' | 'skip' | 'open'` (saf; `result.autoPicked !== true` ise `'open'` (bugünkü yol); `autoPicked` ve `result.url === dismissedUrl` ise `'skip'`; `autoPicked` ve `result.url === shownUrl` ise `'skip'`; aksi halde `'show'`). IPC `server:found-dismiss(url)` (yalnızca `connect.html` göndericisinden, `url` metin) → `{ ok:true }`; `window.ipchat.dismissFound(url)`. `connect.html` `mode=found&found=<JSON {url,name}>` görünümü.

- [ ] **Step 1: Write the failing tests** (`found-policy.test.js`): `not autoPicked -> open`, `autoPicked -> show`, `autoPicked and dismissed url -> skip`, `autoPicked and already shown url -> skip`, `a different autoPicked url than the dismissed/shown one -> show`, `missing/odd input never throws and returns open`.
- [ ] **Step 2: Run to verify failure** — `node --test desktop/test/found-policy.test.js`.
- [ ] **Step 3: Implement `decideFound`** ve ardından `main.js`: modül durumu `foundDismissedUrl`, `foundShownUrl`; `connectToServer` ve `retryInBackground`'da `ok` sonucu için `decideFound`: `'open'` bugünkü gibi (kaydet + aç); `'show'` → `showConnectPage('found', [], { url, name })` ve `foundShownUrl = url` (kaydetme/açma **yok**; mevcut `stillCurrent`/`connectGeneration` korumaları aynen geçerli); `'skip'` → `retryInBackground`'da hiçbir şey, `connectToServer` ilk çağrıda `showConnectPage('manual')`. `foundShownUrl`, `showConnectPage` başka bir modla çağrılınca ve `openServer` ile sıfırlanır; `foundDismissedUrl`, başarılı `server:submit`/`server:confirm` açılışında ve `changeServer` onayında sıfırlanır. `server:found-dismiss` işleyicisi `isTrustedSender` arkasında `foundDismissedUrl = url` yapar. `preload.cjs`: `dismissFound`. **`connect.html` found görünümü** (spec §6.1 metni **aynen**): sunucu adı ve adres (`textContent`), "Bağlan" düğmesi (varsayılan odak, ≥32px), "Başka bir adres yaz" bağlantısı, `aria-live="polite"` geri sayım metni; geri sayım 5 sn; süre bitince ya da "Bağlan"a basınca **tek bir** `submitServer(url)` çağrısı (kilit bayrağı: çift tetik yok); bağlantı hata verirse hata satırı gösterilir ve geri sayım yeniden başlamaz; "Başka bir adres yaz" geri sayımı durdurur, `dismissFound(url)` çağırır, elle adres görünümünü açar. Stil yalnızca tanımlı belirteçlerle.
- [ ] **Step 4: Run to verify pass** — `node --test desktop/test/found-policy.test.js desktop/test/theme-sync.test.js`, `npm test -w desktop` (hepsi geçer), `node --check desktop/src/main.js`.
- [ ] **Step 5: Ölç (Playwright, sahte `window.ipchat`)** — `/opt/node-tools/node_modules/playwright/index.js` (CommonJS: `import pw from '…'; const { chromium } = pw;`), 800x620, `deviceScaleFactor` 2, betik ve görüntüler yalnızca `/tmp/claude-0/-home-user-Ipchat/a5d3bdb1-afd7-5db3-af73-dfd95654057f/scratchpad/ilk/` altında: `connect.html?mode=found&found=…`: (a) görünüm kesilmiyor, düğmeler ≥ 32 px, odak "Bağlan"da; (b) geri sayım yaklaşık 1 sn sonra "4", sonra aşağı iner; 5 sn sonunda `submitServer` **tam bir kez** doğru adresle çağrılır; (c) "Bağlan"a hızlı çift tıklama ve geri sayımla yarış: `submitServer` toplam **bir** çağrı; (d) "Başka bir adres yaz": geri sayım durur (7 sn sonra `submitServer` çağrılmaz), `dismissFound` bir kez çağrılır, elle adres formu görünür; (e) `submitServer` `{ error }` dönerse hata satırı görünür ve yeni geri sayım başlamaz; (f) ad olarak `<img src=x onerror=…>` metin olarak kalır (0 `img`); (g) parlak (parlaklık > 0,4) arka plan taraması: yalnızca vurgu düğmesi; odak halkası kontrastı ≥ 3:1; yazı çiftleri ≥ 4,5:1. Görüntüleri `Read` ile incele, göz yoran bir şey varsa düzelt. Ayrıca `main.js` akışını **satır satır izle** ve raporda şu senaryoların sonucunu yaz: ilk açılış tek sunucu (bilgi ekranı → bağlan → hatırlanır); bilgi ekranı açıkken 10 sn'lik deneme (ekran yeniden kurulmaz); "Başka bir adres yaz" sonrası deneme (aynı adres yeniden önerilmez); `changeServer` sonrası (tek girişli liste, bilgi ekranı **yok**); iki sunucu (liste, bilgi ekranı yok); kimlik `changed` (bilinen ekran).
- [ ] **Step 6: Commit** — `feat(masaustu): ilk baglantida "sunucu bulundu" bilgi ekrani (geri sayimli, dogrulanmis yoldan baglanir)`

---

### Task 3: Giriş ekranı açıklamaları (web)

**Files:**
- Create: `web/src/lib/loginHelp.js`, `web/test/login-help.test.js`
- Modify: `web/src/pages/LoginScreen.jsx`, `web/src/style.css`

**Interfaces:**
- Produces: `loginHelp.js` metin sabitleri: `LOGIN_HELP`, `REGISTER_HELP`, `WAITING_HELP`, `PIN_HELP` (spec §6.2 metinleri **aynen**; `WAITING_HELP` mevcut iki cümleyi **korur** ve ekler: "Yöneticinin seni onaylaması gerekiyor; gecikirse yöneticiye haber ver.").

- [ ] **Step 1: Write the failing tests** (`login-help.test.js`): `LOGIN_HELP mentions the PIN and the register button label` ("Hesabım yok, kayıt olmak istiyorum"), `REGISTER_HELP says approval by the administrator is needed and that the first account becomes administrator`, `WAITING_HELP tells to inform the administrator`, `PIN_HELP points to "Farklı hesapla giriş yap"`, `help texts are non-empty strings without markup characters` (`<` `>` yok).
- [ ] **Step 2: Run to verify failure** — `node --test web/test/login-help.test.js`.
- [ ] **Step 3: Implement** — metin modülü; `LoginScreen.jsx`'de dört yerde (`mode === 'password'` giriş/kayıt, `'waiting'`, `'pin'`) `<p className="help">…</p>`; `style.css`'e `.help` kuralı: `--muted` yazı, küçük boyut, `line-height`, yalnızca belirteç (renk değeri yok), kart içinde taşma yok. Düzen/davranış değişmez.
- [ ] **Step 4: Run to verify pass** — hedef test, `npm test -w web` (tema testi dahil yeşil), `npm run build`.
- [ ] **Step 5: Ölç (Playwright, gerçek sunucu + uydurma kullanıcılar)** — `/tmp/claude-0/-home-user-Ipchat/a5d3bdb1-afd7-5db3-af73-dfd95654057f/scratchpad/tema/shoot.mjs` önizleme betiği (gerçek sunucuyu geçici veriyle başlatır; `mudur` yönetici + onaylı kullanıcılar + bir bekleyen) kopyalanıp **scratchpad'de** (`.../scratchpad/ilk/`) uyarlanır; 800x620, `deviceScaleFactor` 2: giriş, kayıt, onay bekleme (yeni bir kullanıcı kayıt olunca), PIN belirleme sonrası PIN giriş ekranı (aynı bilgisayarda cihaz kaydıyla yeniden açıldığında). Her ekranda `.help` metninin göründüğünü, kesilmediğini, kartın 800x620'de taşmadığını, `.help` yazısının zemin üstünde ≥ 4,5:1 olduğunu ölç; görüntüleri `Read` ile incele.
- [ ] **Step 6: Commit** — `feat(web): giris, kayit, onay bekleme ve PIN ekranlarina aciklayici metinler`

---

## Self-Review

**Spec coverage.** §2 hedefler → Task 2 ve 3; §6.1 bilgi ekranı metni/geri sayım/odak/`aria-live`/ilk kez/doğrulanmış yol/"Başka bir adres yaz" unutma → Task 1 (işaret) ve Task 2; §6.2 dört metin → Task 3; §8 riskler (geri sayım–arka plan çakışması) → Task 2'nin `decideFound` testleri ve izi. Dosya gönderimi bu planda **yoktur** (ayrı tasarım ve plan).

**Type/name consistency.** `autoPicked`/`name` Task 1'de üretilir, Task 2'de tüketilir; `decideFound` imzası ve `dismissFound` adı Task 2 içinde tutarlı; metin sabit adları Task 3'te tek yerde.

**Proportion.** Plan, tasarım belgesinden kısa; gövde kodu yok, imza, kural ve ölçümler var.
