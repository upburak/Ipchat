# Dosya Gönderimi Görünümü (kısa tasarım)

Tarih: 2026-11-27
Durum: onaylandı (kullanıcı, 2026-11-27), üç ek ile (§7.6); 0.6.2 sürümünde çıkacak
İlgili: `2026-11-27-koyu-tema-design.md`

## 1. Amaç ve neden

Kullanıcının sözleriyle: sohbette ataç ile dosya seçilip gönderilirken *"sahte de olsa bir yükleme görseli"*, *"gerçek dosya boyutu"* ve *"dosyanın türüne göre ikonu"* görünsün.

Bugün: dosya `fetch` ile yüklenir (ilerleme yok, düğme pasif olur), mesajda yalnızca `📎 dosyaadı` bağlantısı çıkar (boyut ve tür ipucu yok), resimler olduğu gibi gösterilir, 25 MB'ı aşan dosyada kullanıcıya hiçbir şey söylenmez (hata yutulur).

## 2. Hedefler

- Gönderilirken sohbetin altında **"yükleniyor" kartı**: tür ikonu, dosya adı, gerçek boyut, **gerçek yüzde** çubuğu, iptal düğmesi.
- Gönderilmiş her dosya mesajında **kart**: tür ikonu, ad, **gerçek boyut**; kartın tamamı indirme bağlantısıdır.
- Hata durumunda anlaşılır Türkçe satır (çok büyük, bağlantı koptu, iptal edildi).
- İkon **dosya türüne göre**: resim, PDF, Word, Excel, PowerPoint, metin, sıkıştırılmış, ses, video, diğer.

## 3. Kapsam dışı

Birden çok dosyayı aynı anda göndermek; resim küçük önizlemesi/galeri; dosya paylaşımı ajanı (M3, ayrı iş); boyut sınırını değiştirmek (25 MB kalır); eski mesajların boyutunu sonradan hesaplamak.

## 4. Anti-hedefler

- Sahte (gerçeği yansıtmayan) boyut ya da yüzde. Çubuk **gerçek yüklenen bayt oranını** gösterir; tek "sahte" öğe, çok küçük dosyada kartın yanıp sönmemesi için en az ~600 ms görünür kalmasıdır (yüzde yine gerçek).
- Renkli/rengârenk ikon seti, süs; ikonlar sade, tek renkli (`currentColor`), tema belirteçleriyle.
- İstemcinin bildirdiği boyuta güvenmek: boyut **sunucuda diskteki dosyadan** okunur.

## 5. Kısıtlar

- Yeni bağımlılık yok (ikonlar satır içi SVG), düz CSS, tema belirteçleri; testler `node:test`. Metinler Türkçe.
- Sohbet arayüzü **sunucudan gelir**, boyut için sunucuda da değişiklik gerekir (sunucu güncellenmeden hem yeni görünüm hem boyut gelmez).

## 6. Yaklaşımlar

- **A. `fetch` ile bırakıp sahte animasyon.** Yüzde gerçek olmaz. Elendi (anti-hedef).
- **B. `XMLHttpRequest` ile yüklemek (seçildi).** Tarayıcının kendi `upload.onprogress` olayı gerçek bayt sayısını verir; iptal `abort()` ile yapılır; yeni kütüphane gerekmez.
- **C. Hazır yükleme kütüphanesi.** Kısıta aykırı. Elendi.

## 7. Kararlar

### 7.1 Boyutun saklanması (sunucu)

`messages` tablosuna `file_size INTEGER` sütunu eklenir (`migrate.js` ile, mevcut veriye zarar vermeden; eski mesajlarda `NULL`, kartta boyut gösterilmez). `POST /api/upload` yanıtına `fileSize` (multer'ın `req.file.size`'ı) eklenir. Mesaj gönderilirken (`message:send`) sunucu **istemcinin söylediği boyutu kullanmaz**: `fileUrl` yalnızca `/uploads/<dosya>` biçimindeyse ve dosya yükleme klasöründe varsa boyutu `fs.statSync` ile okuyup yazar (yol atlatma yok); aksi hâlde `NULL`. Mesajı alan taraf `file_size`'ı hem canlı olaydan hem geçmiş listesinden alır.

### 7.2 Yükleme kartı (web)

Sohbetin mesaj listesinin sonunda (kendi mesaj balonu gibi sağda): ikon · ad · "1,2 MB" · yüzde çubuğu · "İptal". Bitince kart, gerçek mesajla yer değiştirir. Hata: kart kırmızı (tehlike) satırla "Gönderilemedi: …" gösterir ve birkaç saniye sonra kalkar ya da kapatılır. Gönder düğmesi ve yazı alanı yükleme sırasında pasif kalır (bugünkü gibi).

### 7.3 Dosya mesajı kartı

Ikon (tür kutusunun içine dosya uzantısı, örn. `PDF`, `DOCX`, en çok 4 harf), ad (uzunsa üç noktalı), ikinci satırda boyut. Resimler bugünkü gibi resim olarak gösterilir, altına ad ve boyut satırı eklenir. Kart bir bağlantıdır (indirme, `rel="noreferrer"`).

### 7.4 İkon seti ve boyut biçimi

Tür, **uzantıdan** (yoksa MIME'dan) belirlenir; tek bir saf fonksiyon (`fileKind(name, mime)`). Gruplar: resim, pdf, word (doc/docx/odt/rtf), excel (xls/xlsx/ods/csv), powerpoint (ppt/pptx/odp), metin (txt/md/log), arşiv (zip/rar/7z/tar/gz), ses, video, diğer. Boyut Türkçe ondalık virgülle: `0 B`, `512 B`, `1,5 KB`, `1,2 MB` (en çok bir ondalık, 1024 tabanlı).

### 7.5 Hata durumları

25 MB üstü dosya **seçilir seçilmez** (yüklemeden önce) "Dosya çok büyük (en çok 25 MB)" denir; sunucu reddederse (413) aynı iletiyi gösterir; ağ kopması "Bağlantı koptu, tekrar dene"; iptal sessizce kartı kaldırır. Hata hiçbir durumda sessizce yutulmaz (bugünkü açık).

### 7.6 Onay sırasında eklenenler (kullanıcı seçti, 2026-11-27)

1. **İndirilen dosyanın adı.** Sunucu dosyaları rastgele adla saklar (`<32 hex>.<uzantı>`); `/uploads/` yanıtı bugün `Content-Disposition: attachment` verir ama dosya adı vermez, bu yüzden tarayıcılar çoğunlukla rastgele adı kaydeder. Kart bağlantısı `…/uploads/<dosya>?name=<özgün ad>` olur; sunucu `?name=` değerini **temizleyip** (yol ayırıcılar, denetim karakterleri, tırnak, CR/LF atılır; en çok 200 karakter) `Content-Disposition: attachment; filename="<ASCII yedek>"; filename*=UTF-8''<yüzde kodlu ad>` olarak yanıta koyar; `name` yoksa bugünkü gibi yalnızca `attachment`. Başlık enjeksiyonu mümkün olmamalıdır (testle).
2. **Program dosyası uyarısı.** `fileKind` ayrıca `program` türünü döndürür (son uzantı: `exe, msi, bat, cmd, com, scr, ps1, vbs, vbe, js, jse, wsf, jar, lnk, reg`; `rapor.pdf.exe` gibi çift uzantıda **son** uzantı sayılır). Bu türün kartında ayrı bir ikon ve küçük not görünür: *"Program dosyası: tanıdığın biri göndermediyse açma."* Hiçbir şey engellenmez.
3. **Çoklu dosya uyarısı.** Birden çok dosya bırakılır/seçilirse **ilki** gönderilir ve kullanıcıya "Aynı anda bir dosya gönderilebilir; ilk dosya gönderildi." denir (birkaç saniye sonra kalkar); hiçbir dosya sessizce yok sayılmaz.
4. **Yüklenen dosyaların temizliği** bu işe **girmez**; ileriki iş: her dosya sunucu bilgisayarında sınırsız kalır (25 MB'a kadar), disk aylar içinde dolabilir. CLAUDE.md "Sıradaki işler"e ve README `Sınırlar`'a yazılır.

## 8. Builder'a bırakılanlar

İkon çizimleri (sade satır içi SVG'ler), kartın CSS'i (tema belirteçlerinden, gerekirse yeni belirteç tema testine eklenerek), `xhr` sarmalayıcısının biçimi (saf, test edilebilir parçalar ayrı: `formatSize`, `fileKind`, yüzde hesabı), 600 ms en az görünürlüğün uygulanışı, sunucuda `file_size` göçü ve yol güvenliği testleri, Playwright ile ekran ölçümü (yükleme kartı, dosya kartları, hata).

## 9. Riskler

- Sunucu ve istemci birlikte güncellenmezse: eski sunucu `fileSize` döndürmez (kartta boyut görünmez, çökmemeli); eski istemci yeni mesajları eski biçimde (ataç + ad) gösterir.
- Gerçek yükleme ilerlemesi ancak büyük dosya ya da yavaş ağda gözle görülür; yerel ağda 25 MB bile hızlı yüklenir, bu yüzden 600 ms kuralı vardır.
- Geçmiş mesajların boyutu olmaz (`NULL`).
- Gerçek Electron/Windows/Mac'te denenmedi; tarayıcıda Playwright ile ölçülür.
