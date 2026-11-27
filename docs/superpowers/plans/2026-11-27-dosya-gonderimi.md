# Dosya Gönderimi Görünümü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sohbette dosya gönderirken gerçek yüklenme çubuğu, gerçek dosya boyutu ve dosya türüne göre ikon göstermek; indirilen dosyanın özgün adını korumak; program dosyalarını uyarmak; birden çok dosya bırakılınca kullanıcıyı bilgilendirmek.

**Architecture:** Sunucu boyutu diskten okuyup `messages.file_size` sütununda saklar ve indirme yanıtına özgün adı koyar; web'de saf yardımcılar (`formatSize`, `fileKind`, yüzde, doğrulama) ve `XMLHttpRequest` tabanlı bir yükleyici ayrı modüllerdedir (testli); arayüz bunları `FileIcon`/dosya kartı/yükleme kartı ile gösterir. Renkler yalnızca tema belirteçleridir.

**Tech Stack:** Node.js >= 22.5, Express + multer + `node:sqlite`, React + Vite + düz CSS, `node:test`, Playwright (yalnızca ölçüm).

**Spec:** `docs/superpowers/specs/2026-11-27-dosya-gonderimi-gorunumu-design.md` (onaylı, §7.6 ekleriyle). Metinler ve kurallar orada **kelimesi kelimesine**.

## Global Constraints

- Yeni bağımlılık ve yeni test kütüphanesi yok (ikonlar satır içi SVG); testler `node:test`. Metinler Türkçe; commit mesajları Türkçe ve dispatch'te verilen `Co-Authored-By` satırlarıyla biter. **Amend, rebase, reset yok.** Repo herkese açık.
- Renk değeri yazılmaz (`#hex`, `rgb(`, `hsl(` vb.): yalnızca `var(--…)`; ikonlar `currentColor`. `web/test/theme-contrast.test.js` (blok dışında renk sabiti yok, kontrast, yasaklı efektler) yeşil kalır; yeni belirteç gerekirse **her tema bloğuna** aynı adla eklenir, değeri ölçülerek (≥ 4.5:1 yazı, ≥ 3:1 sınır) seçilir ve testte kapsanır; `desktop/` kopyaları (`connect.html`, `welcome.html`) bu işe dokunmaz.
- Boyut sınırı 25 MB kalır. Hata iletileri Türkçe, hiçbiri sessizce yutulmaz.
- İstemcinin bildirdiği boyuta **güvenilmez**: boyutu sunucu diskten okur. `/uploads/` yanıtı `Content-Disposition: attachment` ve `X-Content-Type-Options: nosniff` başlıklarını korur.
- Mevcut mesaj/ yükleme akışı ve eski mesajlar bozulmaz: `file_size` NULL olabilir (kartta boyut gösterilmez); eski sunucu `fileSize` döndürmezse yükleme/kart çökmez.

## Review Focus

1. **Başlık enjeksiyonu / yol atlatma**: `?name=` içinde CR/LF, tırnak, `..`, `/`, çok uzun ya da Unicode ad `Content-Disposition`'ı bozmamalı; `message:send`'deki `fileUrl` ile yükleme klasörü dışındaki bir dosyanın boyutu okunmamalı (Task 1 testleri).
2. **İstemci boyutuna güven**: sahte `fileSize` gönderen istemci kayda geçen boyutu değiştirememeli (Task 1).
3. **Çift uzantı hilesi**: `rapor.pdf.exe` program sayılmalı, `program.exe.pdf` PDF sayılmalı; büyük/küçük harf ve noktasız/çok uzun/Unicode adlar çökertmemeli (Task 2).
4. **Yükleme durumları**: iptal, 25 MB üstü, ağ kopması, 413, sunucudan bozuk JSON; kart hiçbir durumda takılı kalmamalı, Gönder/alan pasif kalıp geri açılmalı (Task 2 ve 3).
5. **Koyu temada görünüm**: ikon, kart, çubuk ve uyarı notu ≥ 4.5:1 / ≥ 3:1, parlak kutu yok (Task 3 ölçümü).

---

### Task 1: Sunucu — boyut, indirme adı

**Files:**
- Modify: `server/src/db.js` ya da `server/src/migrate.js` (göç), `server/src/routes/upload.js`, `server/src/sockets/chat.js`, `server/src/routes/messages.js` (geçmiş listesinde `file_size`), `server/src/index.js` (statik servis başlığı)
- Create: `server/src/content-disposition.js`
- Test: `server/test/content-disposition.test.js`, `server/test/file-size.test.js`

**Interfaces:**
- Produces: `contentDisposition(name: unknown): string` (saf, **asla fırlatmaz**; temizlenmiş ad boşsa `'attachment'`; aksi `attachment; filename="<ASCII yedek>"; filename*=UTF-8''<yüzde kodlu ad>`); `POST /api/upload` yanıtına `fileSize: number` eklenir; `messages.file_size INTEGER` (NULL olabilir); `message:send` yükü `fileSize` **kabul etmez/yok sayar**, sunucu boyutu `fs.statSync` ile `uploadsDir` içindeki dosyadan okur (`fileUrl` yalnızca `/uploads/<[0-9a-f]{32}(.uzantı)?>` biçimindeyse ve dosya varsa; aksi hâlde NULL); mesaj olayı ve geçmiş listesi `file_size` alanını taşır.

- [ ] **Step 1: Write the failing tests** — `content-disposition.test.js`: `plain ascii name`, `unicode (ğüşıöçĞÜŞİÖÇ) goes into filename* percent-encoded with an ASCII fallback`, `quotes and backslashes cannot break out of the header`, `CR LF and other control chars are removed (no header injection)`, `path separators are removed (a/b\\c -> abc)`, `names longer than 200 chars are truncated and keep a short extension`, `empty/undefined/non-string/only-forbidden-chars -> plain attachment`, `never throws on odd input (null, number, object, 1MB string)`. `file-size.test.js` (gerçek `express` + geçici veri klasörü + gerçek upload, yerleşik `fetch`/`FormData`): `upload response carries the real byte size`, `message:send stores the size read from disk and ignores a forged fileSize`, `a fileUrl outside uploads (../, absolute path, another extension pattern) stores NULL size and does not read the file`, `a missing file stores NULL`, `old messages (no file_size) still list with file_size null`, `the migration is idempotent and keeps existing rows`, `GET /uploads/<file>?name=… sends the sanitized filename and keeps attachment + nosniff; without name only attachment`.
- [ ] **Step 2: Run to verify failure** — `node --test server/test/content-disposition.test.js server/test/file-size.test.js`.
- [ ] **Step 3: Implement** — göç (`ALTER TABLE messages ADD COLUMN file_size INTEGER`, sütun varsa atla); `upload.js` yanıtına `fileSize: req.file.size`; `chat.js` boyutu diskten okur (yol: `path.basename` + biçim denetimi + `uploadsDir` içinde kalma), `INSERT` ve yayınlanan mesaja `file_size`; `messages.js` listesi `file_size` seçer; `index.js` `setHeaders(res, filePath)`'te `res.req.query.name` varsa `contentDisposition(name)` başlığı, yoksa bugünkü `attachment`.
- [ ] **Step 4: Run to verify pass** — hedef testler, sonra `npm test -w server` (hepsi geçer).
- [ ] **Step 5: Commit** — `feat(sunucu): dosya boyutu diskten okunup saklanir, indirmede ozgun dosya adi`

---

### Task 2: Web — saf yardımcılar ve yükleyici

**Files:**
- Create: `web/src/lib/files.js`, `web/src/lib/upload.js`
- Test: `web/test/files.test.js`, `web/test/upload.test.js`
- Modify: `web/src/lib/api.js` (yalnızca `upload` artık `upload.js`'i kullanır; imza geriye uyumlu)

**Interfaces:**
- Produces (`files.js`, saf, **asla fırlatmaz**): `MAX_UPLOAD_BYTES = 26214400`; `formatSize(bytes: unknown): string` (`'0 B'`, `'512 B'`, `'1,5 KB'`, `'1,2 MB'`; en çok bir ondalık, ondalık virgül, 1024 tabanı; sayı olmayan/negatif/NaN → `''`); `fileKind(name: unknown, mime?: unknown): 'image'|'pdf'|'word'|'excel'|'powerpoint'|'text'|'archive'|'audio'|'video'|'program'|'other'` (**son uzantı**, büyük/küçük harf duyarsız; uzantı yoksa MIME'dan); `fileExtLabel(name: unknown): string` (en çok 4 karakter, büyük harf, uzantı yoksa `''`); `isProgramKind(kind): boolean`; `PROGRAM_NOTE = 'Program dosyası: tanıdığın biri göndermediyse açma.'`; `percent(loaded: number, total: number): number` (0..100 tamsayı, `total <= 0` → 0); `checkFile(file: {size:number}): { ok: true } | { ok: false, error: string }` (`size > MAX_UPLOAD_BYTES` → `'Dosya çok büyük (en çok 25 MB)'`). `MULTI_FILE_NOTE = 'Aynı anda bir dosya gönderilebilir; ilk dosya gönderildi.'`
- Produces (`upload.js`): `uploadFile(file, { url, token, onProgress, XHR = XMLHttpRequest }): { promise: Promise<{url,fileName,fileType,fileSize?}>, abort(): void }`; ilerleme olayı `onProgress({ loaded, total })`; hatalar `Error` ile Türkçe: 413 → `'Dosya çok büyük (en çok 25 MB)'`, ağ hatası → `'Bağlantı koptu, tekrar dene'`, iptal → `Error` ile `error.code === 'ABORTED'`, diğer durum → sunucunun `error` metni ya da `'Yükleme başarısız'`; bozuk JSON → `'Yükleme başarısız'`; `Authorization: Bearer <token>` başlığı, gövde `FormData` (`file`).

- [ ] **Step 1: Write the failing tests** — `files.test.js`: `formatSize` (0, 1, 512, 1023, 1024, 1536 → `1,5 KB`, 1048576, 1288490 → `1,2 MB`, 26214400, negatif/NaN/string → `''`); `fileKind` her grup için örnekler ve **Review Focus 3** (`rapor.pdf.exe`→program, `program.exe.pdf`→pdf, `FOTO.JPG`→image, `a.TAR.GZ`→archive, noktasız ad + MIME `application/pdf`→pdf, `.gitignore`, uzantı `.`, çok uzun ad, Unicode ad, `null`/sayı çökmez → `other`); `fileExtLabel` (`pdf`→`PDF`, `docx`→`DOCX`, `jpeg`→`JPEG`, `bir_cok_uzun.uzanti`→ilk 4 harf, noktasız→`''`); `percent` (sınırlar, `total` 0, loaded>total → 100); `checkFile` (25 MB tam sınır geçer, 25 MB+1 hata); sabit metinler birebir. `upload.test.js` (sahte XHR sınıfıyla): `reports real progress from upload.onprogress`, `resolves with the parsed server response`, `sends the bearer token and a FormData body`, `maps 413 to the size message`, `maps a network error`, `abort() rejects with code ABORTED and calls xhr.abort`, `a non-json body is a failure not a crash`, `onProgress with lengthComputable false is ignored`.
- [ ] **Step 2: Run to verify failure** — `node --test web/test/files.test.js web/test/upload.test.js`.
- [ ] **Step 3: Implement** both modules; `api.upload(file)` imzası aynı kalır (içeride `uploadFile`; ilerleme için isteğe bağlı ikinci argüman).
- [ ] **Step 4: Run to verify pass** — hedef testler, `npm test -w web`, `npm run build`.
- [ ] **Step 5: Commit** — `feat(web): dosya yardimcilari (boyut, tur, program uyarisi) ve ilerlemeli yukleyici`

---

### Task 3: Web arayüzü — ikon, dosya kartı, yükleme kartı, uyarılar

**Files:**
- Create: `web/src/components/FileIcon.jsx`, `web/src/components/FileCard.jsx`
- Modify: `web/src/components/ChatWindow.jsx`, `web/src/style.css`, `web/test/theme-contrast.test.js` (yalnızca yeni belirteç/çift gerekirse)

**Interfaces:**
- Consumes: Task 1 (`file_size` alanı mesajda; `?name=` ile indirme bağlantısı), Task 2 (`fileKind`, `fileExtLabel`, `formatSize`, `percent`, `checkFile`, `uploadFile`, `PROGRAM_NOTE`, `MULTI_FILE_NOTE`).
- Produces: `FileIcon({ kind, label })` (sade tek renkli satır içi SVG, `currentColor`, 10 tür + program için ayrı çizim, uzantı etiketi içinde; `aria-hidden`); `FileCard({ href, name, size, kind, label, note })` (kartın tamamı `<a>`, `rel="noreferrer"`).

- [ ] **Step 1: Write the failing test** (gerekiyorsa) — yeni CSS belirteçleri varsa `theme-contrast.test.js`'e çiftleri eklenir (RED); yoksa bu adım "yok, bileşenler testsiz arayüzdür; ölçüm Step 4" diye raporda söylenir.
- [ ] **Step 2: Implement** — `ChatWindow.jsx`: (a) dosya mesajı (resim dışı) `FileCard` ile; href = `${serverUrl}${m.file_url}?name=${encodeURIComponent(m.file_name)}`; `file_size` varsa `formatSize`; program türünde `PROGRAM_NOTE`; resimlerde `<img>` aynen, altına ad + boyut satırı; (b) `handleFile(file)`: önce `checkFile` (büyükse **yüklemeden** hata satırı), sonra `uploadFile` ile; **yükleme kartı** (mesaj listesinin sonunda, kendi mesajı gibi sağda): `FileIcon`, ad, `formatSize(file.size)`, `percent` çubuğu (`role="progressbar"`, `aria-valuenow`), `İptal` düğmesi; kart **en az 600 ms** görünür kalır (yüzde gerçek, yalnızca kartın kalkması geciktirilir); başarıda gerçek mesaj gelince kart kalkar; hata/iptalde kart kalkar ve hata satırı (tehlike belirteci, `role="alert"`) birkaç saniye görünür; yükleme sırasında Gönder ve yazı alanı pasif, her durumda yeniden açılır (`finally`); (c) birden çok dosya (`drop` ya da seçim) → ilki gönderilir ve `MULTI_FILE_NOTE` bilgi satırı birkaç saniye görünür (sessiz yok sayma yok); (d) sürükle-bırak ve ataç yolu aynı `handleFile`. `style.css`: yalnızca belirteçler; kart, çubuk, ikon, not, hata/bilgi satırı; 800x620'de taşma ve kesilme yok.
- [ ] **Step 3: Run** — `npm test -w web` (tema testi dahil yeşil), `npm run build`.
- [ ] **Step 4: Ölç (Playwright, gerçek sunucu + uydurma kullanıcılar)** — `/tmp/claude-0/-home-user-Ipchat/a5d3bdb1-afd7-5db3-af73-dfd95654057f/scratchpad/tema/shoot.mjs` betiğini (gerçek sunucu, geçici veri, `mudur` yönetici + onaylı kullanıcılar + grup + mesajlar, PIN 1234 ile UI girişi) `/tmp/claude-0/-home-user-Ipchat/a5d3bdb1-afd7-5db3-af73-dfd95654057f/scratchpad/dosya/` altına kopyalayıp uyarla (`/opt/node-tools/node_modules/playwright/index.js`, CommonJS: `import pw from '…'; const { chromium } = pw;`; 800x620, `deviceScaleFactor` 2; depoya hiçbir şey koyma). Senaryolar ve **sayılar**: (1) 6 MB'lık dosya, CDP `Network.emulateNetworkConditions` ile yükleme hızı ~1,5 MB/s: yükleme kartı görünür, çubuk yüzdesi **birden çok kez artar** (örnekle: ilk/orta/son yüzde), tamamlanınca kart kalkar ve mesajda `FileCard` + gerçek boyut (`formatSize(6291456)` = `6,0 MB`; sunucudaki `file_size` ile eşleşir) görünür; (2) küçük dosya (3 KB): kart en az 600 ms görünür (zaman ölç) ve yine kalkar; (3) iptal: kart kalkar, istek iptal, Gönder yeniden açık; (4) 26 MB dosya: **yüklemeden** "Dosya çok büyük (en çok 25 MB)" satırı, ağ isteği yok; (5) `rapor_kasim.pdf`, `ozet.docx`, `tablo.xlsx`, `sunum.pptx`, `notlar.txt`, `arsiv.zip`, `ses.mp3`, `video.mp4`, `foto.png`, `bilinmeyen.xyz`, `kurulum.exe`, `rapor.pdf.exe` karşılıklı mesaj kartları: ikon türü ve uzantı etiketi doğru, `.exe` ve `.pdf.exe` kartında `PROGRAM_NOTE` var, `bilinmeyen.xyz` diğer ikonu; (6) iki dosya sürükle-bırak (`DataTransfer`): ilk dosya gider, `MULTI_FILE_NOTE` görünür ve birkaç sn sonra kalkar; (7) indirme: karta tıklanınca istek `?name=rapor_kasim.pdf` ile gider ve yanıtın `Content-Disposition` başlığında `filename*=UTF-8''rapor_kasim.pdf` var; Türkçe ad (`Öğrenci Listesi ğüş.pdf`) için başlık doğru kodlu; (8) parlak (parlaklık > 0,4) arka plan taraması: yalnızca vurgu dolguları; kart/not/hata satırı yazı çiftleri ≥ 4,5:1, çubuk ≥ 3:1 (ölçümle); klavye odağı karta ve İptal'e görünür. Görüntüleri `Read` ile incele; göz yoran, kesilen ya da düzensiz olanı düzelt.
- [ ] **Step 5: Commit** — `feat(web): dosya gonderiminde yukleme karti, gercek boyut, tur ikonlari, program uyarisi, coklu dosya bilgisi`

---

### Task 4: Belgeler ve sürüm 0.6.2

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `desktop/package.json` (`version`: `0.6.2`), tasarım belgelerinin `Durum:` satırları

- [ ] **Step 1: README** — "Mesajlaşma" bölümüne dosya gönderimi (yükleme çubuğu, boyut, ikon, program uyarısı, tek dosya, 25 MB sınırı, eski mesajlarda boyutun görünmemesi); "Kullanım"a ilk bağlantı bilgi ekranı (geri sayım, yalnızca ilk kez); giriş ekranı açıklamaları; `Sınırlar`'a: yüklenen dosyalar sunucuda silinmez, disk dolabilir (ileriki iş), ve dosya/giriş görünümleri **sunucudan gelir** (önce sunucu bilgisayarını güncelle); `Yayın`'da örnek etiket `test-0.6.3`. **Sürüm geçmişine satır EKLEME** (denetleyici, `main`'e aldıktan sonra yazar).
- [ ] **Step 2: CLAUDE.md** — "0.6.2'de kodlandı: ilk bağlantı bilgi ekranı, giriş açıklamaları, dosya gönderimi görünümü" bölümü: ne yapıldı; **otomatik doğrulanan** (gerçek sayılar: `npm test -w server`, `-w web`, `-w desktop`, `npm run build` çıktılarını **kendin çalıştırıp** yaz); **Linux'ta Playwright ile ölçülen** (raporlardan özetle, sayı uydurma); **gerçek ortamda denenmedi** (bilgi ekranı Electron'da, gerçek ağda yükleme ilerlemesi, Windows/Mac'te dosya indirme adı, Mac); bilinen sınırlar; "Bilinen tuzaklar"a: `file_size` sunucuda diskten okunur, istemciye güvenilmez; indirme adı `?name=` ile gelir ve `content-disposition.js` ile temizlenir; "Sıradaki işler"e **yüklenen dosyaların temizliği ve yükleme klasörü boyutu** ekle; sürüm `0.6.2`.
- [ ] **Step 3: Tasarım belgeleri** — iki spec'in `Durum:` satırı: uygulandı (0.6.2), yalnızca CLAUDE.md'de yazan ölçülerle denendi.
- [ ] **Step 4: Tüm doğrulama** — `npm test -w server && npm test -w web && npm test -w desktop && npm run build`; gerçek sayıları rapora yaz.
- [ ] **Step 5: Commit** — `chore: surum 0.6.2, ilk baglanti bilgi ekrani, giris aciklamalari ve dosya gonderimi belgelendi`

---

## Self-Review

**Spec coverage.** §2 hedefler → Task 1–3; §4 anti-hedefler (sahte boyut/yüzde, istemci boyutuna güven, süs ikon) → Task 1 testleri, Task 2 yükleyici, Task 3 ölçümleri; §5 kısıtlar → Global Constraints; §7.1 boyut saklama → Task 1; §7.2 yükleme kartı ve 600 ms → Task 3; §7.3 kart → Task 3; §7.4 ikon/boyut biçimi → Task 2; §7.5 hata durumları → Task 2 + 3; §7.6 (1) indirme adı → Task 1 + 3, (2) program uyarısı → Task 2 + 3, (3) çoklu dosya → Task 2 + 3, (4) temizlik → Task 4 belgeleri (kod yok); §9 riskler (eski sunucu `fileSize` yok) → Global Constraints + Task 3 (`file_size` yoksa boyut gösterilmez).

**Type/name consistency.** `fileKind`/`fileExtLabel`/`formatSize`/`percent`/`checkFile`/`uploadFile`/`PROGRAM_NOTE`/`MULTI_FILE_NOTE` Task 2'de tanımlanır, Task 3'te aynı adlarla kullanılır; `file_size` (veritabanı/mesaj alanı) ve `fileSize` (yükleme yanıtı) farkı Task 1'de açıkça yazılı; `?name=` Task 1'de sunucuda, Task 3'te istemcide.

**Proportion.** Plan, tasarımın ~iki katından kısa; gövde kodu yok, imza, kural ve ölçümler var.
