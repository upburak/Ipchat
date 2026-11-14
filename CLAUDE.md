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

- **Mac imzası:** Uygulama `identity: "-"` (geçici imza) ile paketlenir. İmzasız/yarım imzalı çıkarsa macOS **Yerel Ağ iznini sessizce reddeder** (`No route to host`, bağlantı 6 ms'de düşer). `NSLocalNetworkUsageDescription` de `desktop/package.json` içinde tanımlı olmalı. Tarayıcıdan inen Mac zip'inde karantina olur; Sistem Ayarları → Gizlilik ve Güvenlik → "Yine de Aç" ya da `xattr -cr`.
- **Windows güvenlik duvarı:** `netsh advfirewall show currentprofile` çıktısındaki `LocalFirewallRules N/A (GPO-store only)` satırı **normaldir**, kurum ilkesi anlamına gelmez (bir kez yanlış yorumlandı). Gerçek tespit kayıt defteri: `HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\<Profil>\AllowLocalPolicyMerge` (bkz. `desktop/src/firewall-policy.js`). Kurulum yönetici izniyle (`perMachine`) TCP 3000 ve UDP 41234 kurallarını ekler.
- **Aynı ağda cihazlar birbirini görmeyebilir:** mesh/modemde istemci yalıtımı ya da farklı düğümlere bağlı olmak. Teşhis için ARP, `ping`, telefon hotspot'u testi kullanıldı.
- **Google Drive/senkronize klasörler** `node_modules` içinde `dosya 2`, `dosya 3` kopyaları üretebilir (esbuild bozulmuştu). Proje senkronize bir klasörde tutulmamalı.
- **NSIS (Windows kurulumu):** `desktop/build/installer.nsh`. Güncelleme sırasında (`isUpdated`) kaldırma temizliği ve veri sorusu atlanır; sessiz kaldırmada veri silinmez. Otomatik başlatma kaydı adı `Ipchat` (`desktop/src/autostart.js`). Bu betik yalnızca CI'da derlenip gerçek Windows'ta elle denenebildi.
- **Kullanıcı verisi:** Windows `%APPDATA%\ipchat-desktop`, Mac `~/Library/Application Support/ipchat-desktop` (sunucu verisi altındaki `server-data`). Uygulama kaldırılınca otomatik silinmez (Windows kaldırıcısı sorar; Mac'te tepsiden "Ipchat'i tamamen kaldır…").

## Kullanıcıyla çalışma notları (konuşmalardan)

- Kullanıcı yazılımcı değil, projeyi test eden ve yöneten kişi. Türkçe, sade ve adım adım anlat; teknik terimi kısa açıkla. Windows/Mac'te yapması gereken adımları numaralı ve **Terminal komutu olmadan** (mümkünse) ver; komut şartsa tek satırlık ve açıklamalı yaz.
- Gerçek testleri kullanıcı yapar: bir Windows PC (Wi-Fi, Intel kart) ve bir Mac (Apple Silicon). Sen uygulamaları gözle deneyemezsin; neyi nasıl denetleyeceğini adım adım söyle, çıktısını/ekran görüntüsünü iste ve **tahmin yürütme, ölç**: komut çıktısı ve gerçek deneme olmadan "bu sebep" deme. (Yanlış teşhisler: Windows GPO yanılgısı, Mac imza sorunu uzun sürdü.)
- Kullanıcı bir şeyin "olmadı" dediğinde neyin olmadığını, hangi cihazda, ekranda ne yazdığını sor.
- Dosyalar GitHub Release üzerinden verilir (yukarıdaki etiket yöntemi). Kullanıcıdan bilgisayarında klasör açmasını/Terminal kullanmasını beklememeye çalış.
- Public işlemlerden önce (Release, `main`'e push) kısa bilgi ver; repo herkese açık, içine gizli bilgi, parola, hesap verisi koyma.

## Bekleyen karar

`docs/superpowers/specs/2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md` kullanıcıya sunuldu ve **onayı bekleniyor**. Kullanıcı okunmamış mesaj takibinin sunucuda tutulmasını (A seçeneği, uygulama kapalıyken gelen mesajlar da görünsün) seçti. Kullanıcı "onaylıyorum" derse `superpowers:writing-plans` ile plan yaz, sonra uygula (önce başarısız test), bağımsız inceleme yaptır, sürüm numarasını artırıp etiketle yayınla.

## Güncel durum (2026-11-14)

Tamam ve çalışıyor: hesap onayı ve yönetici paneli (M1), Electron kabuğu + UDP keşif (M2), sunucu modu, 3 sn yenileme, yönetici bildirimi ve rozet, yönetici izinli Windows kurulumu/kaldırma, B tasarımı, Mac imza düzeltmesi (0.2.2). Mac↔Windows bağlantısı hotspot'ta doğrulandı.

Sıradaki işler:
1. **Okunmamış mesaj noktası + anlık mesaj bildirimi + ikinci sunucu koruması:** tasarım belgesi hazır (`docs/superpowers/specs/2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md`), kullanıcı onayı bekleniyor. Sonra plan ve kodlama.
2. Dosya paylaşımı ajanı (M3): `docs/superpowers/specs/2026-11-13-ipchat-dosya-paylasimi-design.md` (onaylı). Öncesinde sunucu kimliği sabitleme (parmak izi) eklenmeli.
3. Emoji seçici ve diğer mesajlaşma özellikleri (kullanıcı "şu an yok" dedi).
4. Cihazlar birbirini göremediğinde isteğe bağlı aktarma (relay) modu fikri.
5. Ertelenen küçük bulgular için git geçmişindeki inceleme notlarına bak (ör. kenar çubuğunda uzun kullanıcı adı taşması, GPO tespiti iyileştirmeleri).
