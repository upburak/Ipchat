# Ipchat: Hesap İsteği Bildirimi, 3 Sn Yenileme, Yönetici Onaylı Kurulum/Kaldırma ve B Tasarımı

Tarih: 2026-11-13
Durum: onay bekliyor
Önceki belge: `2026-11-13-ipchat-dosya-paylasimi-design.md` (M1 ve M2 tamamlandı, M3 hâlâ bekliyor)

## 1. Amaç ve neden

Ipchat, yerel ağda çalışan Messenger tarzı bir mesajlaşma uygulaması. Masaüstü uygulaması (Electron) hem istemci hem de sunucu olabiliyor (sunucu modu). İlk gerçek Windows+Mac testinde şunlar çıktı:

- Onaylanan bir hesap, diğer kullanıcıların kişi listesinde görünmüyor (liste yalnızca girişte bir kez yükleniyor).
- Biri kayıt olduğunda yönetici bunu kendiliğinden öğrenmiyor, "Hesaplar"ı açıp bakması gerekiyor.
- Bu bilgisayarın güvenlik duvarı grup ilkesiyle (GPO) yönetildiği için, yerel kural eklemek işe yaramadı ve sunucu dışarıdan erişilemez kaldı. Hata olarak değil, ortam sınırı olarak ortaya çıktı, ama kullanıcıya bunun neden olduğu söylenmiyor.
- Uygulama kaldırılırken sunucu süreci, güvenlik duvarı kuralları ve otomatik başlatma kaydı arkada kalabilir.
- Arayüz çıplak görünüyor, tasarıma ihtiyaç var.

Hedef kullanıcı: Okul dahil, yerel ağı olan herhangi bir yerdeki kişiler. Uygulama kurulup sorunsuz çalışmalı.

## 2. Hedefler

- Kişi listesi ve (yönetici için) bekleyen hesap sayısı **3 saniyede bir** kendiliğinden güncellensin.
- Yönetici, yeni hesap isteğini **rozet** (Hesaplar düğmesinde ve tepsi/dock ikonunda sayı) ve **işletim sistemi bildirimi** ile öğrensin; pencere kapalı/tepside olsa da.
- Windows kurulumu **bir kez yönetici izni** istesin; programı tüm kullanıcılar için kursun; güvenlik duvarı kurallarını (TCP 3000, UDP 41234) kendisi eklesin.
- Uygulama Denetim Masası/Ayarlar > Uygulamalar'dan kaldırılınca çalışan sunucu durdurulsun, güvenlik duvarı kuralları ve otomatik başlatma kaydı silinsin, **mesaj verisi silinmeden önce bir kez sorulsun** (varsayılan: sil).
- Tüm arayüz, kullanıcının seçtiği **B tarzında** (modern ve sade) yeniden tasarlansın.
- Sunucu olarak çalışan bilgisayarın güvenlik duvarı kurum ilkesiyle kısıtlıysa uygulama bunu fark edip kullanıcıya açıkça söylesin.

## 3. Kapsam dışı

- Kurum ilkesinin (GPO) engellediği içeri bağlantıyı aşmak (hiçbir kurulum bunu yapamaz). Bu bilgisayarlar istemci olarak çalışır.
- Dosya paylaşımı ajanı (M3) ve sunucu kimliği sabitleme. Önceki belgede planlı.
- Anlık itme (Socket.IO ile haber verme): kullanıcı 3 sn yenilemeyi seçti.
- Kod imzalama/noterlik (SmartScreen ve Gatekeeper uyarıları sürer), otomatik güncelleme, koyu tema.
- Intel Mac sürümü. Şimdilik yalnızca Apple Silicon.

## 4. Anti-hedefler

- Kaldırırken kullanıcının sohbet geçmişini sormadan silmek.
- Kurulumun güvenlik duvarını gereğinden geniş açması (yalnızca iki port, program yolu bağımsız kural).
- Bildirimin sohbet ekranını kilitlemesi veya her 3 saniyede bir yeniden bildirim spam'ı.
- Yenilemenin açık sohbeti, kaydırma konumunu veya yazılmakta olan mesajı bozması.

## 5. Kısıtlar

- Mevcut yığın: Electron 45.3.2 (kesin sürüm), electron-builder (NSIS/Windows, zip/Mac), React + zustand + Vite web arayüzü, Node.js sunucusu (Express, Socket.IO, node:sqlite). Kod GitHub'da public (`github.com/upburak/Ipchat`).
- Uygulamada HTTPS yok; yalnızca LAN.
- Web arayüzü sunucudan servis ediliyor; tasarım değişikliği web arayüzü kodunda yapılır ve masaüstü uygulaması, tarayıcı ve eklenti aynı arayüzü kullanır.
- Pencere 800x620, büyütülemez (kullanıcının önceki isteği).
- Kurulumda yönetici izni **seçildi** (A seçeneği). Kullanıcı bunu açıkça onayladı.

## 6. Yaklaşımlar

**Yenileme/bildirim mekanizması**
- **1. 3 saniyelik yenileme (seçildi).** İstemci 3 sn'de bir kişi listesini ve (yöneticiyse) bekleyen hesap sayısını ister. Sayı artarsa bildirim gösterilir. Tek mekanizma, bağlantı kopup gelince kendiliğinden toparlar, kod ve test az. Gecikme en çok 3 sn. LAN'da dakikada ~20 istek istemci başına önemsiz.
- **2. Anlık haber (Socket.IO) + 3 sn yedek.** Bildirim anında gelir; iki mekanizma yazılıp test edilir. Kazanç 0-3 sn. Elendi.

**Kurulum/kaldırma:** electron-builder'ın NSIS yapılandırmasını özel bir NSIS betiğiyle (`installer.nsh`) genişletmek tek mantıklı yol. Ayrı bir kurulum programı yazmak, güvenlik duvarı ve kaldırma adımlarını Windows'un kendi kaldırma kaydıyla bütünleştiremez. Elendi.

## 7. Kararlar

### 7.1 Liste ve rozet yenileme
- Giriş yapılmış istemci, **3 saniyede bir** `GET /api/users` çağırır ve kişi listesini birleştirir. Çevrimiçi/çevrimdışı durumu mevcut Socket.IO `presence:update` olayından gelmeye devam eder; yenileme bu durumu ezmez.
- Yenileme aktif sohbeti, mesajları ve yazılmakta olan metni etkilemez; yalnızca kişi listesi güncellenir.
- Gizli/arka plan penceresinde de çalışmalı: masaüstü uygulaması `backgroundThrottling: false` ile açılır (tepsideyken zamanlayıcılar yavaşlamasın).
- Giriş ekranındayken ve oturum yokken yenileme çalışmaz.

### 7.2 Yönetici bildirimi
- Yönetici istemci 3 sn'de bir bekleyen hesapları sorar. Yeni hafif uç: `GET /api/admin/pending-count` → `{count, latest: [{id, username}]}` (`latest`: en yeni en fazla 5 bekleyen hesap; yönetici gerektirir). Birden çok yönetici olabilir; her yönetici istemcisi kendi oturumunda ayrı izler.
- Oturum açıldıktan sonraki **ilk** okumada bildirim gösterilmez, yalnızca rozet kurulur ve görülen hesap kimlikleri kaydedilir (zaten bekleyenler için bildirim yağmuru olmasın). Sonraki okumalarda `latest` içinde **daha önce görülmemiş bir hesap kimliği** varsa bildirim gösterilir ("Yeni hesap isteği: <kullanıcı adı>"; birden çok ise "N yeni hesap isteği"). Böylece iki yoklama arasında biri onaylanıp biri kayıt olsa da bildirim kaçmaz. Rozet sayısı her zaman `count` değeridir.
- Rozet: "Hesaplar" düğmesinde kırmızı sayı; tepside ikon **uyarı rengi** varyantına geçer ve ipucu metni sayıyı yazar (Windows tepsisi sayı gösteremez); Mac'te menü çubuğu başlığı ve Dock rozeti sayıyı gösterir.
- Masaüstü uygulamasında bildirim, işletim sistemi bildirimi olarak ana süreçten gösterilir. Web sayfası ile ana süreç arasındaki köprü yalnızca `notify` ve `setBadge` işlevlerini sunar (başlık/gövde metni uzunlukla sınırlı). Ana süreç, çağrının geldiği çerçevenin adresinin kaynağını (origin), uygulamanın **şu an bağlı olduğu sunucunun** kaynağıyla karşılaştırır ve eşleşmezse reddeder. Yerel `connect.html` sayfası bu işlevleri kullanamaz; ona yalnızca mevcut `submitServer` ve `hostServer` işlevleri açık kalır ve onlar da yalnızca yerel dosyadan gelen çağrılara cevap verir. Bildirime tıklayınca pencere öne gelir ve Hesaplar paneli açılır.
- Tarayıcıdan kullananlar (masaüstü uygulaması olmayan) için yalnızca sayfa içi rozet vardır.

### 7.3 Windows kurulumu (yönetici onaylı)
- Kurulum **bilgisayardaki tüm kullanıcılar için** (per-machine, `Program Files`) yapılır ve UAC ile yönetici izni ister.
- Kurulum sırasında iki gelen kuralı eklenir: TCP 3000 ve UDP 41234, adı "Ipchat", tüm ağ profilleri. Kural program yoluna değil porta bağlıdır.
- Kurulumdan önce çalışan eski Ipchat süreci varsa kapatılır.
- Kurulum bittikten sonra uygulama açılır.
- Şu an kurulu olan **kullanıcı başına** sürüm (`perMachine: false`, `%LOCALAPPDATA%` altında) varsa kurulum bunu algılar ve kaldırır; **verisine dokunmaz**. Böylece iki kopya ve çift otomatik başlatma kaydı oluşmaz.
- Kurulum türü: `perMachine: true`, `oneClick: true` (tek tıkla, UAC izniyle). Elle konum seçimi yoktur.

### 7.4 Kaldırma (Denetim Masası/Ayarlar > Uygulamalar)
- Çalışan Ipchat ve onun sunucu alt süreci sonlandırılır.
- "Ipchat" güvenlik duvarı kuralları silinir.
- Otomatik başlatma kaydı silinir (kaldırmayı yapan kullanıcı için; diğer kullanıcılarda uygulama silindiği için kayıt zaten çalışmaz).
- **Mesaj verisi silinmeden önce bir kez sorulur.** Silinecek klasör uygulamanın kullanıcı veri klasörüdür (Windows `%APPDATA%\ipchat-desktop`, Mac `~/Library/Application Support/ipchat-desktop`); sunucunun veritabanı ve yüklenen dosyalar bunun altındaki `server-data` içindedir. Yönetici hesabıyla kaldırma yapılırsa bile kaldırıcı **kaldırmayı başlatan kullanıcının** profilini hedefler. Bilgisayardaki diğer kullanıcıların veri klasörlerine dokunulmaz. "Sohbet geçmişi ve ayarlar da silinsin mi? Bu işlem geri alınamaz." Varsayılan düğme **Evet (sil)**. Sessiz kaldırmada (`/S`) soru sorulmaz ve **veri silinmez** (kullanıcı verisini sessizce silmeme ilkesi).
- Mac'te sürükle-bırak kaldırma sunucu sürecini veya veriyi temizleyemez. Bu yüzden tepsi menüsüne **"Ipchat'i tamamen kaldır…"** eklenir: onay sorar ("Sohbet geçmişi de silinsin mi?", varsayılan **Evet**), sunucuyu durdurur, `setLoginItemSettings({ openAtLogin: false })` ile otomatik başlatmayı kaldırır, veriyi seçime göre siler, uygulama paketini (`shell.trashItem`) her konumdan Çöp Kutusu'na taşır ve çıkar. Windows'ta aynı menü öğesi Uygulamalar'daki kaldırıcıyı başlatır.

### 7.5 "Her yerde çalışsın": ortam sınırının görünür olması
- Sunucu modu her açıldığında Windows'ta grup ilkesi kaydı okunur: `HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\{DomainProfile,PrivateProfile,PublicProfile}` altında `AllowLocalPolicyMerge` değeri **0** ise o profilde yerel kurallar yok sayılır. Kayıt tabanlı olduğu için Windows'un dilinden bağımsızdır (çıktı ayrıştırılmaz). Herhangi bir profilde 0 ise bağlantı sayfasında ve tepside kalıcı uyarı gösterilir: "Bu bilgisayarın güvenlik duvarı kurum tarafından yönetiliyor. Başka cihazlar sunucuya bağlanamayabilir. Sunucuyu başka bir bilgisayarda çalıştırmayı dene." Sunucu yine de başlar.
- Mac ilk sunucu başlatmada sistem iznini kendisi sorar; bu uygulama tarafından değiştirilemez, README'de anlatılır.

### 7.6 Tasarım (B: modern ve sade)
- Tüm ekranlar B tarzına geçer: giriş, sohbet, kişi listesi, grup penceresi, Hesaplar paneli ve masaüstü bağlantı sayfası.
- Değerler (B taslağından): yüzey beyaz, sayfa zemini açık gri-mavi (`#f3f4f8`), kenarlık `#e6e8ef`, metin `#1d2433`, vurgu rengi mor-mavi (`#6366f1`), çevrimiçi yeşil (`#22c55e`), rozet kırmızısı (`#ef4444`), 12 px köşe yarıçapı, sistem yazı tipi.
- Avatarlar yuvarlak ve kullanıcı adının baş harfi; renk kullanıcı adından deterministik seçilir.
- Mesaj balonları yuvarlak (12 px), gönderenin balonu vurgu renginde ve sağda, karşı tarafınki beyaz ve solda; balonun konuşmacı tarafındaki köşesi 2 px.
- Pencere 800x620 sabit; mevcut kural korunur: tarayıcı penceresi 820 px'ten dar ya da 620 px'ten alçaksa arayüz pencereyi tamamen doldurur.
- Onaylanan taslak `docs/superpowers/specs/assets/tasarim-taslaklari.html` dosyasındadır (üç yönden **B** seçildi). Yerleşim ve renkler o dosyadan alınır.

## 8. Benim verdiğim kararlar (kullanıcıdan açıkça onay alınmadı)

- Sessiz kaldırmada veri silinmez (kullanıcı verisini sessizce silmeme ilkesi).
- Bildirim, oturum sonrası ilk okumada gösterilmez, yalnızca artışta gösterilir.
- Yeni `GET /api/admin/pending-count` ucu.
- Windows tepsisinde sayı yerine uyarı rengi ikonu + ipucu metni; Mac'te başlık + Dock rozeti.
- `backgroundThrottling: false`.
- GPO tespiti `netsh` çıktısını ayrıştırarak yapılır, uyarı ile yetinilir (sunucu başlatılmaya devam eder).
- Mac için "tamamen kaldır" tepsi menüsü; veri silme varsayılanı Evet.
- Bekleyen hesap yoklaması `{count, latest}` döndürür; bildirim kararı görülmemiş hesap kimliğine göre verilir (yalnızca sayı artışına göre değil).
- Köprü kaynak kuralı: çağrı çerçevesinin kaynağı, bağlı olunan sunucunun kaynağıyla aynı olmalı.
- Eski kullanıcı-başına kurulum yeni kurulumda otomatik kaldırılır, verisi korunur; `oneClick: true` + `perMachine: true`.
- Güvenlik duvarı ilkesi tespiti `netsh` çıktısı yerine kayıt defteri (`AllowLocalPolicyMerge`) ile yapılır (dilden bağımsız).
- Kaldırıcı yalnızca kaldırmayı başlatan kullanıcının verisini hedefler.
- Tepsi uyarı ikonu: mevcut ikonların kırmızı noktalı varyantları (Mac'te şablon olmayan renkli görüntü).
- Yalnızca Apple Silicon Mac, imzasız.
- Renk değerleri ve avatar renk üretimi.

## 9. Builder'a bırakılanlar

- NSIS betiğinin ayrıntıları (`installer.nsh` makroları, kullanıcı bağlamı: kaldırmayı yapan yönetici hesabının `%APPDATA%`'sının doğru kullanıcıya işaret etmesi dahil).
- Bildirim ve rozet için işletim sistemi API'leri, uyarı ikonunun çizimi.
- Yenilemenin kişi listesine birleştirme algoritması (yanıp sönme ve kayma olmadan).
- CSS yapısı, bileşen bölünmesi ve görsel ayrıntılar.
- Yeni uç ve değişikliklerin test stratejisi.

## 10. Açık sınırlar ve riskler

- Kurulum imzasız: Windows SmartScreen ("Bilinmeyen yayıncı") ve Mac Gatekeeper uyarıları devam eder.
- Kurum ilkesiyle yönetilen Windows bilgisayarlar sunucu olamaz; yalnızca uyarı gösterilir.
- Yönetici izni verilmeden kurulum yapılamaz (seçilen yol).
- 3 sn yenileme, çok kullanıcılı büyük ağlarda sunucuya düzenli ama küçük yük bindirir; birkaç düzine istemci için sorun beklenmiyor.
