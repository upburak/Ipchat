# Ipchat

Okul/ofis yerel ağında (LAN/WiFi) çalışan, eski MSN Messenger tarzı bir mesajlaşma uygulaması. İnternet gerekmez, veri dışarı çıkmaz.

Bir bilgisayar **sunucu** olur, diğerleri ona bağlanır. Sunucu olan bilgisayarı ağda kendiliğinden bulur.

> **Yalnızca yerel ağ için tasarlandı.** HTTPS yok, kimlik doğrulama basittir. Sunucuyu internete açmayın.

---

## Kurulum

### Masaüstü uygulaması (önerilen)

Tek program hem **istemci** hem **sunucu** olabilir. Node.js kurmak veya terminal açmak gerekmez.

Dosyalar [Releases](https://github.com/upburak/Ipchat/releases) sayfasındadır.

**Windows**

1. `Ipchat.Setup.x.y.z.exe` dosyasını çalıştır. "Bilinmeyen yayıncı" uyarısında *Yine de çalıştır*.
2. Kurulum **bir kez yönetici izni** ister; programı tüm kullanıcılar için kurar ve güvenlik duvarına iki kural ekler: TCP 3000 (sohbet) ve UDP 41234 (sunucu keşfi).

**Mac (Apple Silicon)**

1. Zip'i aç, `Ipchat.app`'i **Uygulamalar**'a taşı.
2. İlk açılışta "hatalı/zedelenmiş, Çöp Sepeti'ne taşı" uyarısı çıkarsa uygulama bozuk değildir — macOS internetten inen imzasız uygulamalara karantina koyar. Terminal'de şu tek satır bunu kaldırır:

   ```bash
   xattr -cr /Applications/Ipchat.app
   ```

3. İlk bağlantıda çıkan **"Ipchat yerel ağdaki cihazları bulmak ve bağlanmak istiyor"** penceresinde **İzin ver**'e bas. İzin verilmezse bağlantı sessizce başarısız olur (Sistem Ayarları → Gizlilik ve Güvenlik → Yerel Ağ'dan sonradan açılabilir).

### Tarayıcıdan

Kurulum istemeyenler sunucunun adresine gidebilir (örn. `http://192.168.1.10:3000`). Sayfa sunucudan servis edildiği için adres sorulmaz. Tarayıcıda masaüstüne özel şeyler çalışmaz: işletim sistemi bildirimi, tepsi ikonu ve sunucu keşfi yoktur.

### Eski yöntem (yalnızca sunucu, Windows)

`kurulum.bat` ile Node.js'i kendisi kurup sunucuyu arka planda çalıştırabilir. Durdurmak `durdur.bat`, elle başlatmak `baslat-gizli.vbs`, kaldırmak `kaldir.bat`. Masaüstü uygulaması varken bu yola gerek yoktur.

---

## Kullanım

### Sunucu olmak

Uygulamayı aç; ağda sunucu bulamazsa çıkan ekranda **"Bu bilgisayar sunucu olsun"**a tıkla. Onay sorulur, sonra sunucu arka planda çalışmaya başlar — pencere veya terminal açılmaz. Tepsi menüsünde adres görünür, tıklayınca kopyalanır. Ayar hatırlanır; uygulama her açıldığında sunucu da başlar.

**Ağda zaten bir sunucu varsa bu seçenek görünmez**, yerinde "Ağda zaten bir sunucu var" yazar. İkinci bir sunucu kullanıcıları ikiye böler ve birbirlerini göremezler.

Kapatmak: tepsi menüsünden "Sunucu modunu kapat".

### Hesaplar

- Sunucuda **ilk açılan hesap yöneticidir** ve doğrudan girer.
- Sonraki herkes kayıt olur ama hesabı **"onay bekliyor"** durumunda kalır; yönetici onaylayana kadar giremez.
- Giriş: ilk seferde kullanıcı adı + şifre, sonra o cihaz için 4 haneli PIN.

Yönetici **Hesaplar** ekranından bekleyenleri onaylar/reddeder, hesap kapatır/açar, başkasını yönetici yapabilir. Geri alınamayan işlemler (reddet, kapat, yöneticiliği al) onay sorar. Her satırda hesabın durumu (Onaylı / Onay bekliyor / Reddedildi / Kapatıldı) ve ayrıca o an **Çevrimiçi/Çevrimdışı** olduğu görünür — bunlar farklı şeylerdir. Kapatılan kullanıcının açık oturumu hemen düşer.

Tek yönetici şifresini kaybederse, sunucu bilgisayarında:

```bash
npm run reset-admin -- <kullanici-adi> <yeni-sifre>
```

### Mesajlaşma

- Soldaki listeden bir kişiyle veya **+ Yeni** ile kurduğun grupla sohbet et. Liste kalabalıklaşınca üstteki kutudan ara.
- Her mesajda saat, grup sohbetlerinde gönderenin adı, gün değişince "Bugün / Dün / 12 Kasım" ayracı görünür.
- Ataç ikonuyla ya da sürükle-bırak ile dosya ve resim gönderilir.

### Okunmamış mesajlar ve bildirimler

- Okunmamış mesajı olan kişinin satırında **kırmızı nokta** ve kalın ad belirir. Sayı sunucuda tutulur, yani **uygulama kapalıyken gelen mesajlar da** açılışta görünür.
- Mesaj geldiğinde, o sohbet açık ve pencere önde değilse işletim sistemi bildirimi gelir: başlıkta **gönderenin adı**, gövdede sadece "Yeni mesaj". **Mesaj içeriği bildirimde gösterilmez** (başkası ekrana bakabilir). Bildirime tıklayınca pencere öne gelir ve o sohbet açılır.
- Pencere başlığı toplam okunmamışı gösterir: `(3) Ipchat`. Tepsi ikonu ve Mac'te Dock rozeti bekleyen hesap + okunmamış mesaj toplamını gösterir.
- Sohbeti açınca, ya da pencereye geri dönünce nokta kaybolur.

### Genel

Pencere sabit boyutludur (800x620). Kapatınca tepsiye iner; tamamen çıkmak için tepsi menüsünden "Çık". Aynı anda tek örnek çalışır. Kurulu uygulama bilgisayar açılışında başlar (tepsiden kapatılabilir). Kişi listesi ve bekleyen hesaplar 3 saniyede bir yenilenir.

---

## Kaldırma ve veri

Kaldırırken **ne silineceği sorulmaz**. Ne silineceği şudur:

- **Çalışanların (istemci) bilgisayarında her şey silinir:** program, ayarlar, otomatik başlatma, kayıt defteri girdileri, güvenlik duvarı kuralları ve `ipchat-desktop` veri klasörünün tamamı. Bu işlem geri alınamaz. (İstisnalar aşağıda: Windows'taki "Bilinen sınır" ve Mac'te uygulamayı yalnızca Çöp Kutusu'na atmak.)
- **Sunucu olan bilgisayarda da aynı şeyler silinir, yalnızca hesaplar ve mesaj geçmişi silinmez.** Bunlar `server-data` klasöründe durur. İstersen bu klasörü elle silebilirsin. Windows'ta kaldırma bittiğinde Ipchat bu klasörün nerede olduğunu sana söyler (sessiz kaldırmada mesaj çıkmaz); Mac'te yol, onay penceresinde kaldırmadan önce görünür ve sonrasında bir şey çıkmaz. Windows'ta çok nadir olarak klasör geri konamazsa hesaplar ve mesajlar `%APPDATA%\ipchat-server-data-tmp` klasöründe kalır. Ipchat'i bir sonraki açışında bunu sana bir pencereyle söyler ve o klasörü **kendiliğinden silmez**. Geri almak için: Ipchat'i kapat; `%APPDATA%\ipchat-desktop` klasöründe yeni, boş bir `server-data` oluşmuşsa onu sil; sonra `ipchat-server-data-tmp` klasörünü `%APPDATA%\ipchat-desktop` içine taşı ve adını `server-data` yap. (Dosya Gezgini adres çubuğuna `%APPDATA%` yazarak o klasöre gidebilirsin.)
- **Güncelleme sırasında hiçbir şeye dokunulmaz.** Yeni sürümü üstüne kurmak ayarları ve mesajları silmez.

`server-data` klasörü: Windows `%APPDATA%\ipchat-desktop\server-data`, Mac `~/Library/Application Support/ipchat-desktop/server-data`.

### Yedek almak

Hesapları ve mesaj geçmişini yedeklemek için **`server-data` klasörünün tamamını** kopyala (USB'ye, başka bir klasöre). Geri almak için aynı klasörü yerine koy.

> **Dikkat:** içindeki `ipchat.db` dosyası tek başına kopyalanmaz. Uygulama açıkken bu dosya boş (4 KB) görünebilir; son kayıtlar yanındaki `ipchat.db-wal` dosyasında durur. Yalnızca `ipchat.db`'yi kopyalarsan yedek eksik olur. **Klasörün tamamını kopyala**, en güvenlisi de uygulama kapalıyken kopyalamaktır.

- **Windows:** Ayarlar → Uygulamalar → Ipchat → Kaldır. Kural kurulumun sonunda bir kez, kaldırma bittiğinde bir kez daha yazılır. Sessiz kaldırma da aynı şeyleri siler, yalnızca ekrana mesaj çıkarmaz.
  **Bilinen sınır:** standart bir kullanıcı kaldırmayı başka bir yönetici hesabının parolasıyla yükseltirse kaldırıcı o hesabın profiline bakar; kendi verisi kalabilir. O zaman `%APPDATA%\ipchat-desktop` klasörünü elle sil.
  Aynı şey **birkaç kişinin kullandığı bilgisayarda** da olur: kaldırıcı yalnızca kaldırmayı yapan hesabın verisini ve otomatik başlatma kaydını temizler; diğer kullanıcıların her birinde kendi `%APPDATA%\ipchat-desktop` klasörü ve otomatik başlatma kaydı kalır. Onları o kullanıcılar kendi hesaplarından elle silmelidir.
- **Mac:** Mac'te kurulum adımı yoktur, o yüzden bu kural uygulama **ilk açıldığında** bir kez yazılır. Kaldırmak için tepsi menüsünden **"Ipchat'i tamamen kaldır…"** seçilir. Çıkan onay penceresi aynı kuralı tekrar anlatır; seçili düğme **Vazgeç**'tir. Uygulamayı yalnızca Çöp Kutusu'na atarsan sunucu süreci ve veri geride kalır.

---

## Sorun giderme

**Cihazlar birbirini görmüyor.** Çoğu zaman ağ sorunudur, uygulama değil. Mesh/tekrarlayıcılı modemlerde "istemci yalıtımı" açık olabilir ya da cihazlar farklı düğümlere bağlıdır. Hızlı test: iki cihazı bir telefonun hotspot'una bağlayıp dene — orada çalışıyorsa sorun ağdadır.

**Kurum bilgisayarları (GPO).** Güvenlik duvarı grup ilkesiyle yönetiliyorsa yerel kurallar uygulanmaz ve başkaları sunucuya bağlanamayabilir. Uygulama bunu fark edip uyarır. Böyle bilgisayarlar **istemci** olarak sorunsuz çalışır; sunucuyu güvenlik duvarını yönetebildiğin bir bilgisayara kur.

**Mac'te "hatalı/zedelenmiş" uyarısı.** Karantinadır, yukarıdaki `xattr -cr` komutu çözer. Uygulama ücretli Apple sertifikasıyla imzalı olmadığı için her yeni sürümde tekrar gerekir.

**Sunucu adresini bulma.** Windows `ipconfig` → "IPv4 Address"; Mac `ipconfig getifaddr en0`.

---

## Geliştirme

Node.js **22.5+** gerekir (`node:sqlite` için).

```bash
npm install                 # tüm workspace'ler
npm run dev                 # sunucu (3000) + web arayüzü (5173)
npm run build               # web arayüzünü derler (web/dist)
npm start                   # tek port: 3000 hem API/socket hem arayüz
npm start -w desktop        # masaüstü uygulaması (önce sunucu gerekir)
```

Testler (`node:test`, ek kütüphane yok):

```bash
npm test -w server
npm test -w web
npm test -w desktop
```

### Yapı

| Klasör | İçerik |
|---|---|
| `server/` | Express + Socket.IO + `node:sqlite`. Hesaplar, mesajlar, gruplar, okunmamış takibi, yönetici uçları, UDP keşif yanıtı (41234). |
| `web/` | React + Vite + zustand arayüzü. Sunucudan servis edilir; masaüstü uygulaması da aynı arayüzü gösterir. |
| `desktop/` | Electron kabuğu. İstemci + sunucu modu, tepsi ikonu, bildirim köprüsü, sunucu keşfi. |
| `docs/superpowers/` | Tasarım belgeleri (`specs/`) ve uygulama planları (`plans/`). |

### Yayın

Derleme ve dosyalar GitHub Actions ile üretilir, bilgisayara bağlı değildir:

1. `desktop/package.json` içindeki `version` alanını artır.
2. GitHub'da **Releases → Draft a new release**, etiket olarak `test-0.5.1` gibi bir ad yaz ve yayınla.
3. İş akışı derler, `.exe` ve Mac zip'ini o Release'e ekler (~3 dakika).

---

## Sürüm geçmişi

Kurulum dosyaları [Releases](https://github.com/upburak/Ipchat/releases) sayfasındadır; her sürümün etiketi `test-0.5.0` gibidir. En yenisi en üstte.

| Sürüm | Tarih | Ne geldi | Gerçek bilgisayarda denendi mi? |
|---|---|---|---|
| **0.5.0** | 26 Kas 2026 | **Temiz kaldırma.** Kaldırma artık soru sormaz. Çalışanın bilgisayarında program, ayarlar, otomatik başlatma, kayıt defteri girdileri, güvenlik duvarı kuralları ve veri klasörünün tamamı silinir. Sunucu bilgisayarında hesaplar ve mesaj geçmişi **silinmez**, nerede durduğu söylenir. Güncellemede hiçbir şeye dokunulmaz. | Windows'ta **hem sunucu hem istemci olarak denendi ve doğrulandı**: sunucuda geçmiş korundu ve yeniden kurulumdan sonra eski hesapla girildi, istemcide hiç iz kalmadı. Mac tarafı (ilk açılış bildirimi, tepsiden kaldırma) denenmedi. |
| **0.4.0** | 14 Kas 2026 | **Arayüz ergonomisi.** Hesap ekranında bekleyenler önde ve sayılı; geri alınamayan işlemler onay sorar; `Aktif` etiketi **`Onaylı`** oldu ve **Çevrimiçi/Çevrimdışı** ayrı bir bilgi olarak eklendi; hesap ve kişi listelerinde arama. Sohbette saat, grupta gönderenin adı, gün ayracı. Giriş ekranında kalıcı etiketler. Yazılar ve düğmeler daha okunur. | Okuldaki Windows bilgisayarlarda kullanıldı, sorun çıkmadı. Mac'te denenmedi. |
| **0.3.0** | 14 Kas 2026 | **Okunmamış mesaj ve bildirimler.** Okunmamış mesajı olan kişide kırmızı nokta (sayı sunucuda tutulduğu için uygulama kapalıyken gelenler de görünür), mesaj gelince işletim sistemi bildirimi (başlıkta gönderenin adı, gövdede yalnızca "Yeni mesaj"), tepsi/Dock rozeti, pencere başlığında sayı. Ağda sunucu varken ikinci sunucu kurulması engellendi. | Windows ve Mac'te kısmen görüldü: kırmızı nokta, başlıktaki sayı, Mac bildirimi ve "Ağda zaten bir sunucu var" uyarısı. Bildirime tıklayınca sohbetin açılması gibi ayrıntılar denenmedi. |
| **0.2.2** | 14 Kas 2026 | Mac sürümünün imzası düzeltildi. İmza eksik olduğunda macOS, Yerel Ağ iznini sessizce reddediyor ve bağlantı hiç kurulmuyordu. | **Mac ↔ Windows bağlantısı** telefon hotspot'unda çalıştığı görüldü. |
| **0.2.1** | 14 Kas 2026 | Mac'te "Yerel Ağ" izin penceresinin çıkabilmesi için gereken açıklama eklendi. | 0.2.2 ile birlikte denendi. |
| **0.2.0** | 13 Kas 2026 | Windows kurulumu yönetici izniyle çalışıp güvenlik duvarı kurallarını kendisi ekler oldu; kurum ilkesiyle (GPO) yönetilen bilgisayarlar tespit edilip uyarı verilir. Yeni görünüm (avatarlar, yuvarlak baloncuklar). Listeler 3 saniyede bir yenilenir. Yöneticiye bekleyen hesap bildirimi ve rozet. | Windows'ta çalıştığı görüldü. |
| **0.1.0** | 13 Kas 2026 | İlk masaüstü sürümü. Hesap onayı ve yönetici paneli; Electron kabuğu, tepsi ikonu, sabit pencere; sunucuyu ağda kendiliğinden bulma (UDP 41234) ve **sunucu modu** (uygulamanın kendisi sunucu olabilir). | Windows'ta çalıştığı görüldü. |

**Sırada:** sunucu kimliğinin sabitlenmesi (uygulama bağlandığı sunucuyu tanısın), ardından bilgisayarlar arası **dosya paylaşımı**. Tasarım belgeleri `docs/superpowers/specs/` içindedir.

---

## Sınırlar

- Yalnızca yerel ağ. HTTPS yok, sunucu internete açılmamalı.
- Sunucu olan bilgisayar açık ve oturumu açık olmalı.
- Mac uygulaması Apple tarafından onaylı (notarized) değil; her indirmede karantina adımı gerekir.
- Mesaj geçmişi yalnızca sunucu bilgisayarındadır ve kendiliğinden yedeklenmez — yedeği elle alman gerekir (yukarıdaki "Yedek almak").
- Giriş ekranı kayıtlı kullanıcıları listelemez; herkes kendi kullanıcı adını yazar. Kaldırma cihaz kaydını da sildiği için PIN'le hızlı giriş sıfırlanır: yeniden kurulumdan sonra herkes bir kez kullanıcı adı + şifreyle girip yeni PIN belirler.
