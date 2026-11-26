# Ipchat: proje notları (yeni bir oturum önce bunu okusun)

Ipchat, yerel ağda (LAN/WiFi) çalışan, eski MSN Messenger tarzı bir mesajlaşma uygulaması. Kullanıcı Türkçe konuşur; arayüz metinleri, commit ve belgeler Türkçe. Kaynağın tek yeri bu GitHub reposu; yerel bir klasöre bağımlı değil. Windows ve Mac'ten çalışılabilir.

## Yapı

- `server/`: Node.js (Express, Socket.IO, `node:sqlite`). Hesap onayı, mesajlar, gruplar, yönetici uçları (`/api/admin/*`), UDP keşif yanıtı (port 41234).
- `web/`: React + Vite + zustand arayüzü. Sunucudan servis edilir; masaüstü uygulaması, tarayıcı ve eklenti aynı arayüzü kullanır.
- `desktop/`: Electron (45.3.2, kesin sürüm) uygulaması. Hem istemci hem **sunucu modu** (sunucuyu alt süreç olarak barındırır). Tepsi ikonu, bildirim/rozet köprüsü, sunucu keşfi.
- `docs/superpowers/specs/`: onaylı tasarım belgeleri. `docs/superpowers/plans/`: uygulama planları. Yeni işte önce ilgili belgeyi oku.
- Eski kurulum yöntemi (yalnızca sunucu): `kurulum.bat`, `kaldir.bat`, `durdur.bat`, `baslat-gizli.vbs` (Windows).

## Komutlar

```bash
npm install                      # tüm workspace'ler (Electron indirir; electron'un kendi indirmesi npm tarafından engellenirse: node node_modules/electron/install.js)
npm test -w server               # sunucu testleri (node --test)
npm test -w web                  # web mantık testleri
npm test -w desktop              # masaüstü testleri
npm run build                    # web arayüzünü derler (web/dist)
npm start -w desktop             # masaüstü uygulamasını geliştirme modunda açar (önce sunucu gerekir)
npm run dev                      # sunucu + web geliştirme
```

Node.js >= 22.5 gerekir (`node:sqlite`). Testler `node:test` ile yazılır, yeni test kütüphanesi eklenmez.

## Derleme ve yayın (bilgisayardan bağımsız)

GitHub Actions "Masaustu uygulamasi (Windows ve Mac)" iş akışı derler ve Release'e ekler:
- GitHub'da **Releases → Draft a new release**, etiket olarak `test-0.2.3` gibi bir ad yazıp yayınla; iş akışı otomatik derler ve `.exe` ile Mac zip'ini o sürüme ekler.
- Ya da **Actions → Run workflow** ile `tag` alanına bir ad yaz.
- Sürüm numarası `desktop/package.json` içindeki `version` alanıdır; yeni yayın öncesi artır.

## Çalışma kuralları

- Yeni özellik: önce kısa konuşma/tasarım belgesi (kullanıcı onaylar), sonra plan, sonra TDD ile kodlama (önce başarısız test), sonra bağımsız inceleme. Her düzeltme için önce başarısız test.
- Commit mesajının sonuna `Co-Authored-By` satırı eklenir (ortamın verdiği ifadeyle).
- Herkese açık işlemler (Release oluşturma, `main`'e push) kullanıcının isteğiyle yapılır; repo public.
- Doğrulamadığın şeyi doğrulanmış gibi yazma; hangi testin elle/gerçek ortamda yapıldığını söyle.
- **`main`'e her alıştan sonra belgeler sorulmadan güncellenir** (kullanıcının kalıcı isteği, 26 Kasım 2026). Birleştirmeyle aynı turda, ayrı bir commit olarak:
  1. **README → Sürüm geçmişi** tablosuna yeni sürümün satırı eklenir: sürüm no, tarih, kullanıcının anlayacağı dille ne geldiği, ve **gerçek bilgisayarda denenip denenmediği**. Denenmeyeni "denenmedi" diye yaz; tahminle "çalışıyor" yazma.
  2. README'nin **eskiyen yerleri** düzeltilir: kullanım ve kaldırma anlatımı, `Yayın` bölümündeki örnek etiket (bir sonraki sürüm no olacak), `Sınırlar`.
  3. CLAUDE.md'deki **"Güncel durum"** ve ilgili tasarım belgesinin **Durum** satırı güncellenir.
  4. **Release açıklaması metni hazırlanıp kullanıcıya yapıştırması için verilir.** Bu ortamdaki GitHub araçları Release'i okuyabilir ama **metnini değiştiremez** (`gh` yalnızca arama için kullanılabilir). Metin: bu sürümde ne geldiği, denenip denenmediği, Windows/Mac kurulum adımları (Mac'te `xattr -cr /Applications/Ipchat.app` dahil) ve README'nin sürüm geçmişine bağlantı.

## Bilinen tuzaklar (bunlar vakit kaybettirdi)

- **Mac imzası:** Uygulama `identity: "-"` (geçici imza) ile paketlenir. İmzasız/yarım imzalı çıkarsa macOS **Yerel Ağ iznini sessizce reddeder** (`No route to host`, bağlantı 6 ms'de düşer). `NSLocalNetworkUsageDescription` de `desktop/package.json` içinde tanımlı olmalı. Tarayıcıdan inen Mac zip'inde karantina olur; Apple Silicon'da bu **"hatalı/zedelenmiş, Çöp Sepeti'ne taşı"** uyarısı olarak çıkar ve "Yine de Aç" düğmesi çoğu zaman hiç görünmez. Bu imza hatası değil, karantina; uygulama bozuk değildir. **Her yeni derlemeden sonra kullanıcıya şu tek satır verilir** (uygulamayı Uygulamalar'a taşıdıktan sonra): `xattr -cr /Applications/Ipchat.app`. Kalıcı çözüm ücretli Apple Developer ID + notarization'dır; kullanıcı şu an istemiyor (okulda Mac yok).
- **Windows güvenlik duvarı:** `netsh advfirewall show currentprofile` çıktısındaki `LocalFirewallRules N/A (GPO-store only)` satırı **normaldir**, kurum ilkesi anlamına gelmez (bir kez yanlış yorumlandı). Gerçek tespit kayıt defteri: `HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\<Profil>\AllowLocalPolicyMerge` (bkz. `desktop/src/firewall-policy.js`). Kurulum yönetici izniyle (`perMachine`) TCP 3000 ve UDP 41234 kurallarını ekler.
- **Aynı ağda cihazlar birbirini görmeyebilir:** mesh/modemde istemci yalıtımı ya da farklı düğümlere bağlı olmak. Teşhis için ARP, `ping`, telefon hotspot'u testi kullanıldı.
- **Google Drive/senkronize klasörler** `node_modules` içinde `dosya 2`, `dosya 3` kopyaları üretebilir (esbuild bozulmuştu). Proje senkronize bir klasörde tutulmamalı.
- **NSIS (Windows kurulumu):** `desktop/build/installer.nsh`. Güncelleme sırasında (`isUpdated`) kaldırma temizliği ve veri silme tamamen atlanır. Kaldırıcı **soru sormaz** (eski "verileri de sil" sorusu kalktı); sessiz kaldırma da aynı silmeyi yapar, yalnızca mesaj göstermez. İstemcide `ipchat-desktop` tümüyle silinir. Sunucuda (`server-data` varsa) o klasör **taşı-sil-geri koy** ile korunur: önce `ipchat-server-data-tmp`'ye taşınır, geri kalan silinir, sonra geri taşınır. İki hata yolu var. (a) Taşıma başarısız olursa **hiçbir şey silinmez**, klasör olduğu gibi kalır. (b) Geri koyma başarısız olursa `RMDir /r` zaten çalışmıştır: `ipchat-desktop`'un geri kalanı **silinmiştir**, yalnızca `server-data` `%APPDATA%\ipchat-server-data-tmp` içinde kalır. **Bu sıra yalnızca gerçek Windows'ta doğrulanabilir**; betik hiçbir yerde çalıştırılmadı (bu değişiklik için CI'da derlenmedi bile). Otomatik başlatma kaydı adı `Ipchat` (`desktop/src/autostart.js`).
- **Okunmamış sayımı baseline'a dayanır:** `meta` tablosunda `unread_baseline_id` anahtarı kurulum/yükseltmede bir kez yazılır (o anki en büyük mesaj no); ondan eski mesajlar "okunmuş" sayılır. Amaç bu: mevcut veritabanına yükseltince kullanıcı yüzlerce nokta görmesin. Veritabanı sıfırdan kurulur ya da silinirse baseline 0'dan başlar; eski geçmiş kalmadığı için sonraki her mesaj normal sayılır. Mesajlar dururken yalnızca `meta` satırı silinirse baseline o anki en yeni mesaja yeniden yazılır ve ondan eski her şey sessizce okunmuş sayılır.
- **Sunucu kimliği `server-data` ile aynı kaderi paylaşır:** `identity.key` (gizli anahtar) ve `identity.pub` `server-data` içinde durur. Klasör silinirse ya da yeni bilgisayara taşınırken kopyalanmazsa yeni kimlik üretilir ve **her kullanıcı bir kez "Bu sunucu daha önce bağlandığın sunucu değil" ekranını görür**. Yedek **`identity.key`'i de içerir**: yedeği ele geçiren sunucuyu taklit edebilir, yedek korunmalı. `identity.key` bozulursa sunucu **yeni anahtar üretmek yerine hata verip durur** (sessiz kimlik değişimi istenmez). Windows'ta `0o600` dosya izninin etkisiz olması beklenir (orada doğrulanmadı).
- **Kullanıcı verisi:** Windows `%APPDATA%\ipchat-desktop`, Mac `~/Library/Application Support/ipchat-desktop` (sunucu verisi altındaki `server-data`). Kaldırma **hiçbir şey sormaz**: istemci bilgisayarda bu klasörün tamamı silinir (istisnalar: Windows'ta standart kullanıcı kaldırmayı başka bir yöneticinin parolasıyla yükseltirse kendi verisi kalabilir; aynı şekilde birkaç kullanıcılı bilgisayarda kaldırıcı yalnızca kaldırmayı yapan profili temizler, diğer profillerin `%APPDATA%\ipchat-desktop` klasörü ve `Run` değeri elle silinir, bkz. README "Bilinen sınır"; Mac'te uygulamayı yalnızca Çöp Kutusu'na atmak sunucu sürecini ve veriyi bırakır); sunucu bilgisayarda yalnızca `server-data` kalır, gerisi silinir. Mac'te kaldırma tepsiden "Ipchat'i tamamen kaldır…" ile yapılır (onay penceresi vardır, varsayılanı Vazgeç). Güncellemede hiçbir şeye dokunulmaz.

## Kullanıcıyla çalışma notları (konuşmalardan)

- Kullanıcı yazılımcı değil, projeyi test eden ve yöneten kişi. Türkçe, sade ve adım adım anlat; teknik terimi kısa açıkla. Windows/Mac'te yapması gereken adımları numaralı ve **Terminal komutu olmadan** (mümkünse) ver; komut şartsa tek satırlık ve açıklamalı yaz.
- Gerçek testleri kullanıcı yapar: bir Windows PC (Wi-Fi, Intel kart) ve bir Mac (Apple Silicon). Sen uygulamaları gözle deneyemezsin; neyi nasıl denetleyeceğini adım adım söyle, çıktısını/ekran görüntüsünü iste ve **tahmin yürütme, ölç**: komut çıktısı ve gerçek deneme olmadan "bu sebep" deme. (Yanlış teşhisler: Windows GPO yanılgısı, Mac imza sorunu uzun sürdü.)
- Kullanıcı bir şeyin "olmadı" dediğinde neyin olmadığını, hangi cihazda, ekranda ne yazdığını sor.
- Dosyalar GitHub Release üzerinden verilir (yukarıdaki etiket yöntemi). Kullanıcıdan bilgisayarında klasör açmasını/Terminal kullanmasını beklememeye çalış.
- Public işlemlerden önce (Release, `main`'e push) kısa bilgi ver; repo herkese açık, içine gizli bilgi, parola, hesap verisi koyma.

## Güncel durum (2026-11-14)

Tamam ve çalışıyor: hesap onayı ve yönetici paneli (M1), Electron kabuğu + UDP keşif (M2), sunucu modu, 3 sn yenileme, yönetici bildirimi ve rozet, yönetici izinli Windows kurulumu/kaldırma, B tasarımı, Mac imza düzeltmesi (0.2.2). Mac↔Windows bağlantısı hotspot'ta doğrulandı.

0.3.0'da kodlandı: okunmamış mesaj noktası (sunucuda tutulur, uygulama kapalıyken gelenler de görünür), anlık mesaj bildirimi (başlıkta gönderenin adı, gövdede hep `Yeni mesaj`; mesaj içeriği gösterilmez), tepsi/Dock rozeti ve bildirime tıklayınca sohbetin açılması, ikinci sunucu koruması (ağda sunucu varken "Bu bilgisayarı sunucu yap" gizlenir; sunucu modunu açarken onay sorulur). **Bu özelliğin yalnızca saf mantık kısımları otomatik testlerle denendi. (Sunucu 57, web 23, masaüstü 62 test, eski testler dahil tüm takımların toplamıdır; hepsi geçiyor, ama bu sayılar yeni özelliğin kapsamı değildir.) `main.js`, `preload.cjs`, `tray.js` ve `connect.html` Electron'a bağlı olduğu için otomatik testleri yok.**

`test-0.3.0` Release'i yayınlandı, `.exe` ve Mac zip'i üretildi. **Kullanıcı Mac + Windows ile denedi; ekran görüntüsüyle doğrulananlar:** kişi satırında kırmızı okunmamış noktası (Windows), sayfa başlığında `(1) Ipchat` (Windows), Mac bildirimi (başlıkta gönderenin adı, gövdede `Yeni mesaj`), Mac tepsi menüsünde "Bu bilgisayarı sunucu yap" yerine soluk "Ağda zaten bir sunucu var".

**Henüz gerçek ortamda denenmedi** (doğrulanmış gibi yazma): uygulama kapalıyken gelen mesajın açılışta görünmesi, bildirime tıklayınca doğru sohbetin açılması, pencere odağa dönünce noktanın temizlenmesi, sunucu modu onay penceresinin gizli pencerede görünmesi, kapatılan hesabın hayalet rozet bırakmaması, gruba sonradan eklenen kullanıcının sessiz açılışı.

## 0.4.0'da kodlandı: arayüz ergonomisi

Hesap ekranı: bekleyenler önde ve sayılı, "Onayla" dolgulu / "Reddet" sönük, **Reddet/Kapat/Yöneticiliği al için onay penceresi** (varsayılan Vazgeç), `Aktif` → **`Onaylı`** (kullanıcı bunu "şu an bağlı" sanıyordu) ve ayrı **Çevrimiçi/Çevrimdışı** göstergesi, renkli durum etiketleri, arama, satır başına hata, fare listedeyken yenilemenin durması, çift tıklamada sahte hata vermeyen koruma. Sohbet: her mesajda saat, grupta gönderen adı, gün ayracı. Kişi listesinde arama. Girişte kalıcı etiketler, PIN'de tek gönder yolu. Okunabilirlik: `--muted` ve `--danger` koyulaştı, düğmeler ≥32px.

**Tarayıcıda ölçülerek doğrulandı** (Playwright, bu depoda): saatlerin UTC→yerel çevrimi (07:20 UTC → 10:20), hesap satırlarının eşit yüksekliği ve uzun adın kesilmemesi, eşleşmeyen aramada "Eşleşen hesap yok.", çift tıklamada hata çıkmaması.

`test-0.4.0` yayınlandı (14 Kasım). **Kullanıcı okuldaki Windows bilgisayarlarda denedi, sorun bildirmedi (26 Kasım).** Bunun üzerine dal `main`'e alındı ve README baştan yazıldı. **Mac'te 0.4.0 hiç denenmedi** (okulda Mac yok): tepsi menüsünün yeni sırası, "Bağlı: …" durum satırı ve özellikle **pencere gizliyken onay penceresinin görünmesi** Mac'te doğrulanmayı bekliyor — 0.3.0'da tam burada macOS'a özgü bir tuzak çıkmıştı.

Bilinen eksik: `.message.own .message-time` beyaz metni mor baloncukta 4.47:1 — standardın 0.03 altında. Kapatmak uygulamanın imza rengini değiştirmeyi gerektirirdi, bilinçli olarak yapılmadı.

## 0.5.0'da kodlandı: temiz kaldırma

Kural (spec: `docs/superpowers/specs/2026-11-26-temiz-kaldirma-design.md`): kaldırma soru sormaz. İstemcide program, ayar, otomatik başlatma, kayıt defteri, güvenlik duvarı kuralları ve tüm `ipchat-desktop` verisi silinir. Sunucuda `server-data` (hesaplar ve mesajlar) korunur, yolu kullanıcıya söylenir. Güncellemede hiçbir şeye dokunulmaz. Windows kuralı kurulum sonunda ve kaldırmada gösterir; Mac'te kurulum adımı olmadığı için ilk açılışta bir kez ve tepsideki kaldırma onayında gösterir (onayın varsayılanı Vazgeç, "geçmişi de sil" kutusu kalktı).

**Otomatik olarak doğrulanan (Linux'ta):** saf mantık (sunucu mu istemci mi tespiti, silinecekler, ilk açılış bayrağı), Mac kaldırmasının silme komutu Linux'taki gerçek `sh` kabuğunda geçici klasörlerde (Mac'te değil), ve `installer.nsh` **yalnızca metin olarak** (güncelleme, sessiz kaldırma ve geri koyma korumalarının betikte bulunduğu denetlenir; betik çalıştırılmaz). Süitler (belge yazılırken çalıştırıldı): sunucu 58, web 34, masaüstü 83 test geçti, `npm run build` geçti.

**Gerçek Windows'ta doğrulandı (26 Kasım, sunucu bilgisayarı):** kaldırma sonrası `ipchat-desktop` duruyor ve içinde yalnızca `server-data` var; yanında `ipchat-server-data-tmp` **kalmadı** (yani taşı-sil-geri koy sırası sorunsuz tamamlandı); kaldırırken "Bu bilgisayar Ipchat sunucusuydu… silinmedi" penceresi çıktı; yeniden kurulumdan sonra eski kullanıcı adı ve şifresiyle **giriş yapıldı** ve bir gün önceki test yazışması sohbet ekranında **göründü** — yani yalnızca hesaplar değil mesaj geçmişi de bütün olarak korundu. NSIS betiği ilk kez bir bilgisayarda çalıştı ve en riskli dalı doğru çalıştı.

**Dikkat — yedek alırken WAL tuzağı:** uygulama `PRAGMA journal_mode = WAL` kullanıyor, yani uygulama açıkken `ipchat.db` 4 KB (boş) görünebilir ve kayıtlar `ipchat.db-wal` dosyasında durur. Yedek alırken **klasörün tamamı** kopyalanmalı, yalnızca `ipchat.db` değil. Kullanıcı bu yüzden "veri gitmiş" sandı; gitmemişti. (Bir oturumda ben de 4 KB'ı "boş veritabanı" diye yanlış yorumladım; ölçmeden hüküm verme.)

**Giriş ekranı kayıtlı kullanıcıları listelemez** — tasarım böyle. Kaldırma cihaz kaydını da sildiği için PIN'le hızlı giriş sıfırlanır; herkes bir kez kullanıcı adı + şifreyle girip yeni PIN belirler. Bu beklenen davranıştır.

**Gerçek Windows'ta doğrulandı (26 Kasım, istemci bilgisayarı):** kaldırma sonrası `%APPDATA%\ipchat-desktop` klasörü **hiç kalmadı**. Yani iki dalın ikisi de (sunucu: koru, istemci: tamamen sil) gerçek bir bilgisayarda doğru çalıştı.

**Hâlâ gerçek ortamda denenmedi** (doğrulanmış gibi yazma): kurulum sonu bilgi kutusu, sessiz kaldırma, güncelleme atlaması, kilitli dosya kalıntı uyarısı, çok kullanıcılı bilgisayarda diğer profillerin kalıntısı. Mac'te 0.5.0'ın hiçbir parçası (ilk açılış bildirimi, tepsiden kaldırma onayı) denenmedi; 0.4.0 da Mac'te denenmedi (okulda Mac yok). Mac'te ilk açılış bildirimi ve kaldırma onayı da gerçek bir Mac'te çalışmadı (Electron kabuğu otomatik testle kapsanmıyor). Yani bu özellik şu an kimse tarafından elle denenmedi; yayından önce okuldaki Windows'ta hem sunucu hem istemci olarak kaldırmayı dene.

**Karar: uygulamada otomatik güncelleme ya da "yeni sürüm var" kontrolü OLMAYACAK** (kullanıcı, 26 Kasım 2026). Sebep: Windows kurulumu yönetici izni ister, Mac'te Apple imzası yok; kullanıcılar bu ayrıntılarla kurulum yapamaz. Sorun olursa kullanıcı yardım ister ve yeni sürümü okuldaki kullanıcılara kendisi kurar. Bu yüzden Ipchat internete hiç çıkmaz; tekrar önerme.

## 0.6.0'da kodlandı: sunucu kimliği ve ilk açılış onayı

Tasarımlar: `docs/superpowers/specs/2026-11-26-sunucu-kimligi-design.md` ve `docs/superpowers/specs/2026-11-26-ilk-acilis-onayi-design.md`; plan: `docs/superpowers/plans/2026-11-26-sunucu-kimligi-ve-ilk-acilis.md`. Belge yazılırken sürüm `0.6.0` (`desktop/package.json`) ama **henüz `main`'e alınmadı, Release yayınlanmadı** ve README Sürüm geçmişine satır eklenmedi (kural: o satır, ne denendiği bilinince yazılır).

**Ne yapıldı.** (1) Sunucu ilk açılışta Ed25519 kimlik anahtarı üretir (`server-data/identity.key` + `identity.pub`), `GET /api/identity?nonce=` imzalı yanıt verir, UDP keşif yanıtına parmak izinin tamamı (64 hex karakter, `identity.fingerprint`) eklenir; kısa `A1B2-C3D4-E5F6` biçimi yalnızca ekranda gösterilir. (2) Masaüstü ana süreci sohbet sayfası yüklenmeden önce sunucuyu doğrular (rastgele nonce, imza, parmak izi), ilk görülen kimliği `config.json`'a sabitler, kimlik değişirse `connect.html` içinde "Bu sunucu daha önce bağlandığın sunucu değil" ekranını gösterir (varsayılan Vazgeç), keşifte kayıtlı kimliği taşıyan sunucuyu seçer (adres değişimi uyarı üretmez), eski (kimliksiz) sunucuyu ve sürüm düşürmeyi ayırır, kendi sunucusunu `identity.pub` dosyasından okuyarak sorusuz doğrular, sunucu modu kapanınca ve tepsideki "Başka bir sunucuya bağlan…"da (`disableServerMode`) kimliği unutur. (3) İlk açılış onayı: `welcome.html` (risk metni + kaldırma kuralı, iki ayrı onay kutusu, Devam et / Çık); onay verilmeden keşif, bağlanma, sunucu modu, otomatik başlatma kaydı, tepsi ve bildirim çalışmaz; onay `welcomeAccepted: { version: 1, at }` olarak kaydedilir. Mac'teki 0.5.0 `INSTALL_NOTICE` mesaj kutusu kalktı, yerine bu ekran geldi (kaldırma kuralı metni `cleanup.js` içinde `removalRule(platform)` tek kaynağından gelir).

**Otomatik olarak doğrulanan (Linux'ta, belge yazılırken çalıştırıldı):** `npm test -w server` **73**, `npm test -w web` **34**, `npm test -w desktop` **201** test geçti, hiçbiri başarısız değil; `npm run build` geçti. Bunlar tüm takımların toplamıdır (eski testler dahil). Yeni testler yalnızca **saf mantığı** kapsar: sunucuda anahtar üretimi/yeniden okuma/bozuk dosyada durma/imza, `/api/identity` ucu (nonce biçimi), keşif yanıtında parmak izi; masaüstünde doğrulayıcı (**gerçek `server/src/identity.js` modülüyle uyumluluk**, tekrar oynatma, başka anahtarla imza, EC/RSA anahtar reddi, büyük alan sınırları), `verifyServer` (**gerçek `node:http` sunucusuna 127.0.0.1'de** karşı: tanıdık/yeni/değişmiş/desteklenmiyor/geçersiz, eski sunucu, zaman aşımı, sınırlı gövde), kimlik deposu, bağlanma kararı, `resolveServer`, `connect-policy` (sonuç güncel mi, yeniden bağlanma isteği), ilk açılış mantığı (`needsWelcome`) ve `removalRule`.

**Linux'ta elle ölçüldü ama Electron'da değil:** sunucu tarafı gerçek `node src/index.js` ile geçici veri klasöründe denendi (açılışta anahtar üretildi, `curl /api/identity` imzalı yanıt verdi; `identity.key` silinip `identity.pub` kalınca sunucu Türkçe hata verip çıkış koduyla durdu, yeni anahtar üretmedi). HTML sayfaları **Playwright ile (Chromium, 800x620) sahte `window.ipchat` köprüsüyle** ölçüldü: `connect.html` "değişti" ekranı (kesilme yok, odak Vazgeç, çift tıklamada köprü çağrısı 1 kez, Vazgeç eski görünüme dönüyor, "Tanımadığın sunucu" etiketi, ad alanına enjekte edilen HTML metin olarak kalıyor) ve `welcome.html` (Devam et iki kutu işaretlenmeden pasif, alt çubuk kaydırmada sabit, çift tıklamada kabul 1 kez, Çık yalnızca çıkış çağırıyor, metin alanı kaydırılıyor, enjeksiyon yok; pencere başlık çubuğu payı için 581 ve 560 px yükseklikte de kesilme yok). Bu **gerçek pencere değildir**; ölçülen yüksekler gerçek Windows/Mac penceresindeki değerler olamaz.

**Gerçek ortamda denenmedi (doğrulanmış gibi yazma):**
- **Electron kabuğunun tamamı:** `main.js` ve `preload.cjs` hiçbir yerde çalıştırılmadı; yalnızca `node --check` ve kod okuma (bağımsız incelemeler dahil). İlk açılış kapısı (`welcomePending`, `startApp` sırası, `close` ve gezinme korumaları, `welcome:*` IPC, `senderFrame.url` eşleşmesi, onayın `config.json`'a yazılması, ikinci açılışta ekranın çıkmaması), kimlik akışlarının IPC'leri (`server:submit`, `server:confirm`), `config.json`'da `serverIdentity`'nin gerçekten yazılıp silinmesi.
- "Bu sunucu daha önce bağlandığın sunucu değil" akışı **gerçek ağda**: gerçekten başka bir sunucuyla, keşif listesinden seçimle, "Bağlan ve yeni sunucuyu hatırla" sonrası ayarın değişmesi.
- **Kendi sunucu doğrulaması** (sunucu modunda `identity.pub` okuma, 127.0.0.1 eşleşmesi; tepsiden sunucu modu açılamazsa artık bir hata penceresi çıkması gerekir, eskiden hata sessizce yutuluyordu).
- **Kimlik dosyası bozuk/eksikken sunucunun başlamaması** (sunucu 78 çıkış koduyla durur): uygulama açılışında (sunucu modu kayıtlıyken), "Bu bilgisayar sunucu olsun" düğmesinde ve tepside "Sunucu başlatılamadı: sunucunun kimlik dosyası bozuk ya da eksik." penceresinin çıkması; düğmenin altında port mesajı yerine "Sunucu kimlik dosyası okunamadı; ayrıntı için açılan pencereye bak" yazması; pencerenin açılışta bir kez çıkıp kendiliğinden tekrar tekrar açılmaması. Yalnızca saf mantık (çıkış kodu, `startServerProcess` reddi, metin, gösterme kararı) otomatik testle denendi; pencerenin kendisi denenmedi.
- **Gerçek bir sunucunun, istemciler kimlik sabitlemişken güncellenmesi** ve **güncelleme günü senaryosu** (sunucu bilgisayarında güncellemeden sonra ekranın çıkması ve "Devam et"e basılana kadar sunucunun başlamaması).
- **Mac'in tamamı** (ekran gizli pencerede, kimlik akışı, ilk açılış ekranı; okulda Mac yok, 0.3.0'da tam burada macOS'a özgü tuzak çıkmıştı).
- **İlk açılış ekranının Windows'ta ilk kez görünmesi** (gerçek pencerede yükseklik, kaydırma, kutular, Çık; Windows'ta `0o600` izni ve kimlik dosyasının `%APPDATA%` altında davranışı). Windows kurulum sonu kutusu (`installer.nsh`) bu işte değiştirilmedi; ilk açılış ekranıyla kaldırma kuralı Windows'ta iki kez görünür (bilinçli).

**Bilinen sınırlar (README'de de yazılı):**
- **Kimlik doğrulama sahte sunucuların hepsini durdurmaz ve şifreleme değildir.** Kanıtladığı tek şey: kimlik sorusunu yanıtlayan, sunucunun gizli anahtarını biliyor. Kendini sunucu diye **tanıtan** bir bilgisayar (ör. yeni kurulmuş ikinci sunucu) yakalanır. Ama ağdaki herhangi bir bilgisayar keşfe yanıt verip `/api/identity` sorusunu gerçek sunucuya **iletirse** denetimden geçer ve sonra **kendi giriş sayfasını** gösterebilir (canlı aktarma; ARP sahteciliği ya da "araya girme" gerekmez). Hatırlanan adres yanıt vermezse (DHCP değişimi, sunucu yeniden başlıyor) `resolve-server.js` keşifte `known` dönen **ilk adayı** sorusuz seçer; sırayı yanıtların gelişi belirler. Trafik şifrelenmez, dinleyen biri okur. **Karar R6:** keşifte "birden fazla tanıdık aday varsa sor" kuralı eklenmedi (iki ağ kartlı gerçek sunucu aynı parmak izini iki adresten verir, aktarıcıdan ayırt edilemez: koruma getirmeden yanlış alarm üretirdi). Asıl çözüm aşağıdaki "Sıradaki işler" 1.
- **Yeniden doğrulama kapsamı dar:** yalnızca ana sürecin yaptığı yüklemeler (ilk bağlanış, 10 sn'lik arka plan yeniden deneme, `did-fail-load` sonrası). Pencere içinde sayfa yenileme ve Socket.IO'nun kendiliğinden yeniden bağlanması kapsanmaz.
- **Tek kimlik yuvası:** okul ile ev arasında taşınan dizüstü ya da sunucu değiştiren bilgisayar her geçişte değişim ekranını görür.
- **Tepsideki "Başka bir sunucuya bağlan…" (kod adı `changeServer`, tasarımda "Sunucuyu değiştir") ve sunucu modunu kapatmak hatırlanan kimliği siler** (tasarım §7.9.4 ile tutarlı; README'de bir cümle olarak söylendi). Kullanıcıya haber ver.
- **Onay ekranı metnine tasarım §7.1'de olmayan bir alt başlık eklendi: "Kaldırma kuralı"** (`welcome.html`; onay kutusu 2'nin ifadesine bağlamak için, uygulayıcı kararı). Onaylanan metin değişmedi, yalnızca bu başlık fazladır. **Kullanıcıya söyle; istemezse kaldırılır.**
- **Eski (kimliksiz) sunucu için ekran başlığı:** tasarım §7.9.5 cümlesini yeri belirtmeden verdi; uygulayıcı bunu "Bu sunucu kimlik bilgisi vermiyor (eski sürüm olabilir)" başlığı olarak koydu (normal başlığın yerine). Nihai söz kullanıcının.
- **Güncelleme günü (yalnızca bu sürüme, yani 0.6.0'dan eski bir sürümden ilk güncellemede):** sunucu bilgisayarı güncellenince ilk açılış ekranı çıkar ve onaylanana kadar **sunucu başlamaz ve kimse bağlanamaz**. Release notunda ve README'de yazılı: önce sunucu bilgisayarında "Devam et". Sonraki güncellemelerde ekran yeniden çıkmaz; yalnızca metnin içeriği önemli ölçüde değişir ve `WELCOME_VERSION` artırılırsa herkes yeniden onaylar. Onay kaydedilemezse (salt okunur ayar vb.) oturum çalışmaya devam eder, bir sonraki açılışta ekran yine çıkar.
- `Çık` mevcut otomatik başlatma kaydını silmez (tasarım böyle); onay vermeyen kullanıcı her oturum açışında ekranı yeniden görür.
- Parmak izi karşılaştırması onay anında kısa (48 bit) gösterim değeriyle yapılır (`confirmAction`); tam parmak izi sabitleme için kullanılır. Tasarımda bu gösterim sınırına dair risk notu yok.

**Son incelemede düzeltilenler (kod okuyarak ve saf mantık testleriyle; Electron'da denenmedi):** başarısız `enableServerMode` sonrası başlatılan alt süreç artık durdurulur; tepsiden sunucu modu açılamazsa hata penceresi çıkar (eskiden yutuluyordu); `changed` ekranında Vazgeç sonrası "Bu bilgisayar sunucu olsun" kapalı kalır (Playwright ile ölçüldü); onaydan sonra `welcome:quit` reddedilir; bozuk/eksik `identity.key` için açıklama penceresi (yukarıda).

**Ertelenen küçük bulgular (hepsi inceleme turlarında "Minor" sayıldı, düzeltilmedi):** (son incelemeden) kimlik dosyası uyarı penceresi (`identity-store.js`) kullanıcıların göreceği ekranı "sunucu kimliği değişti" diye adlandırıyor, gerçek başlık "Bu sunucu daha önce bağlandığın sunucu değil"; sunucu `identity.key` **yazılamazsa** da (ör. izin hatası) 78 koduyla çıkar ve pencere "bozuk ya da eksik" der, yani tam doğru değil, ve adım 3 ("dosyaları kenara taşı") bu durumda gereksiz kimlik değişimi yaratır; sunucu modundayken kendi sunucusunun doğrulaması (ör. yavaş okul bilgisayarında 1,5 sn zaman aşımı) başarısız olursa alt süreç artık **durdurulur** ve düğmeye basılana ya da uygulama yeniden başlayana kadar sunucu açılmaz (eskiden süreç çalışmaya devam ederdi), gerçek denemede bu bilgisayarda gözle; sunucu modunda anahtar bozukken bağlantı sayfası hâlâ genel "Sunucu ağda otomatik bulunamadı" der (açılan pencere gerçek nedeni söyler); önceden vardı: iki eşzamanlı `openOwnServer` iki alt süreç başlatabilir. (önceki turlardan) `startApp` yarıda hata verirse onay "zaten verildi" der ve ikinci açılış toparlar; kayıt yazılamayan ayarda her açılışta `setLoginItemSettings(true)` yeniden çağrılır; aynı sunucu iki adres dizgisiyle (ana makine adı + IP) ve kimliği değişmişse keşifte iki kez sayılabilir (iki girişli liste çıkar, güvenlik açığı değil); sunucu `identity.key` yazımı atomik değil (dar pencere, güvenli yöne hata verir); seçim listesindeki "Tanımadığın sunucu" etiketi uzun satırda 6 px içeriden başlar (görsel).

Sıradaki işler:
1. **Kanal bağlama (Host imzası) ve şifreleme** (ayrı tasarım gerekir; 0.6.0'daki sunucu anahtarı üzerine kurulur). Kanal bağlama: sunucu, imzaladığı yanıta kendisine hangi adresten (`Host`) sorulduğunu da katar; istemci bunu kendi bağlandığı adresle karşılaştırır, böylece soruyu gerçek sunucuya ileten bir aktarıcı yakalanır. Ardından trafiğin şifrelenmesi. Dosya paylaşımı açılmadan önce yapılır; sayfa içi yenileme/Socket.IO yeniden bağlanmasının doğrulanmaması ve "doğrulama ile yükleme arasındaki boşluk" sınırları da bunun konusudur.
2. Dosya paylaşımı ajanı (M3): `docs/superpowers/specs/2026-11-13-ipchat-dosya-paylasimi-design.md` (onaylı). Öncesinde trafiğin şifrelenmesi gerekir (sunucu kimliği 0.6.0'da kodlandı, yukarıya bak).
3. Emoji seçici ve diğer mesajlaşma özellikleri (kullanıcı "şu an yok" dedi).
4. Cihazlar birbirini göremediğinde isteğe bağlı aktarma (relay) modu fikri.
5. Ertelenen küçük bulgular için git geçmişindeki inceleme notlarına bak (ör. kenar çubuğunda uzun kullanıcı adı taşması, GPO tespiti iyileştirmeleri).
