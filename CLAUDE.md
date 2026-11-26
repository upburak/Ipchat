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

## Bilinen tuzaklar (bunlar vakit kaybettirdi)

- **Mac imzası:** Uygulama `identity: "-"` (geçici imza) ile paketlenir. İmzasız/yarım imzalı çıkarsa macOS **Yerel Ağ iznini sessizce reddeder** (`No route to host`, bağlantı 6 ms'de düşer). `NSLocalNetworkUsageDescription` de `desktop/package.json` içinde tanımlı olmalı. Tarayıcıdan inen Mac zip'inde karantina olur; Apple Silicon'da bu **"hatalı/zedelenmiş, Çöp Sepeti'ne taşı"** uyarısı olarak çıkar ve "Yine de Aç" düğmesi çoğu zaman hiç görünmez. Bu imza hatası değil, karantina; uygulama bozuk değildir. **Her yeni derlemeden sonra kullanıcıya şu tek satır verilir** (uygulamayı Uygulamalar'a taşıdıktan sonra): `xattr -cr /Applications/Ipchat.app`. Kalıcı çözüm ücretli Apple Developer ID + notarization'dır; kullanıcı şu an istemiyor (okulda Mac yok).
- **Windows güvenlik duvarı:** `netsh advfirewall show currentprofile` çıktısındaki `LocalFirewallRules N/A (GPO-store only)` satırı **normaldir**, kurum ilkesi anlamına gelmez (bir kez yanlış yorumlandı). Gerçek tespit kayıt defteri: `HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\<Profil>\AllowLocalPolicyMerge` (bkz. `desktop/src/firewall-policy.js`). Kurulum yönetici izniyle (`perMachine`) TCP 3000 ve UDP 41234 kurallarını ekler.
- **Aynı ağda cihazlar birbirini görmeyebilir:** mesh/modemde istemci yalıtımı ya da farklı düğümlere bağlı olmak. Teşhis için ARP, `ping`, telefon hotspot'u testi kullanıldı.
- **Google Drive/senkronize klasörler** `node_modules` içinde `dosya 2`, `dosya 3` kopyaları üretebilir (esbuild bozulmuştu). Proje senkronize bir klasörde tutulmamalı.
- **NSIS (Windows kurulumu):** `desktop/build/installer.nsh`. Güncelleme sırasında (`isUpdated`) kaldırma temizliği ve veri silme tamamen atlanır. Kaldırıcı **soru sormaz** (eski "verileri de sil" sorusu kalktı); sessiz kaldırma da aynı silmeyi yapar, yalnızca mesaj göstermez. İstemcide `ipchat-desktop` tümüyle silinir. Sunucuda (`server-data` varsa) o klasör **taşı-sil-geri koy** ile korunur: önce `ipchat-server-data-tmp`'ye taşınır, geri kalan silinir, sonra geri taşınır. İki hata yolu var. (a) Taşıma başarısız olursa **hiçbir şey silinmez**, klasör olduğu gibi kalır. (b) Geri koyma başarısız olursa `RMDir /r` zaten çalışmıştır: `ipchat-desktop`'un geri kalanı **silinmiştir**, yalnızca `server-data` `%APPDATA%\ipchat-server-data-tmp` içinde kalır. **Bu sıra yalnızca gerçek Windows'ta doğrulanabilir**; betik hiçbir yerde çalıştırılmadı (bu değişiklik için CI'da derlenmedi bile). Otomatik başlatma kaydı adı `Ipchat` (`desktop/src/autostart.js`).
- **Okunmamış sayımı baseline'a dayanır:** `meta` tablosunda `unread_baseline_id` anahtarı kurulum/yükseltmede bir kez yazılır (o anki en büyük mesaj no); ondan eski mesajlar "okunmuş" sayılır. Amaç bu: mevcut veritabanına yükseltince kullanıcı yüzlerce nokta görmesin. Veritabanı sıfırdan kurulur ya da silinirse baseline 0'dan başlar; eski geçmiş kalmadığı için sonraki her mesaj normal sayılır. Mesajlar dururken yalnızca `meta` satırı silinirse baseline o anki en yeni mesaja yeniden yazılır ve ondan eski her şey sessizce okunmuş sayılır.
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

Sıradaki işler:
1. Dosya paylaşımı ajanı (M3): `docs/superpowers/specs/2026-11-13-ipchat-dosya-paylasimi-design.md` (onaylı). Öncesinde sunucu kimliği sabitleme (parmak izi) eklenmeli.
2. Emoji seçici ve diğer mesajlaşma özellikleri (kullanıcı "şu an yok" dedi).
3. Cihazlar birbirini göremediğinde isteğe bağlı aktarma (relay) modu fikri.
4. Ertelenen küçük bulgular için git geçmişindeki inceleme notlarına bak (ör. kenar çubuğunda uzun kullanıcı adı taşması, GPO tespiti iyileştirmeleri).
