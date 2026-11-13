# Ipchat

Yerel ağ (LAN/WiFi) üzerinde çalışan, eski MSN Messenger tarzı bir mesajlaşma uygulaması. Merkezi bir Node.js sunucusu + React web istemcisinden oluşur.

## Hızlı kurulum (Windows — önerilen)

`Ipchat` klasörünü (veya `Ipchat-kurulum.zip`'i açıp) bilgisayara kopyala, **`kurulum.bat`**'a çift tıkla. Script sana sorar:

### [1] Sunucu kurulumu (ağda 1 bilgisayara)
- Node.js kurulu değilse **güncel LTS sürümünü indirip sessizce kurar** (yönetici izni ister)
- Bağımlılıkları kurar ve web arayüzünü derler
- Güvenlik duvarında 3000 portunu açar
- İstersen bilgisayar açılışında otomatik başlatmayı ayarlar
- Sunucuyu başlatır ve **diğer bilgisayarların bağlanacağı adresi ekranda gösterir**

Sunucuyu daha sonra elle başlatmak için: `baslat.bat`

### [2] İstemci kurulumu (mesajlaşacak bilgisayarlara)
- Node.js ve yönetici izni **gerekmez**
- Sunucu adresini sorar, bağlantıyı test eder
- Masaüstüne **Ipchat kısayolu** koyar: uygulama Chrome/Edge'in uygulama modunda, adres çubuksuz, **Messenger benzeri küçük sabit boyutlu bir pencerede** açılır

İstemci kurulumu yapmak istemeyenler tarayıcıdan da bağlanabilir (örn. `http://192.168.1.10:3000`) — sayfa sunucudan servis edildiği için **IP sorulmaz, otomatik bağlanır**.

## Masaüstü uygulaması (Windows ve Mac) — önerilen yol

Tek program hem **istemci** hem de **sunucu** olabilir; Node.js kurmak veya terminal açmak gerekmez.

**Kurulum**
- **Windows:** `Ipchat Setup x.y.z.exe` dosyasını çalıştır ("Bilinmeyen yayıncı" uyarısında *Yine de çalıştır*). Kurulum **bir kez yönetici izni** ister, programı bilgisayardaki tüm kullanıcılar için kurar ve güvenlik duvarına yalnızca iki kural ekler: TCP 3000 (sohbet) ve UDP 41234 (sunucu keşfi). Kaldırmak için: Ayarlar → Uygulamalar → Ipchat → Kaldır; kaldırıcı çalışan sunucuyu durdurur, güvenlik duvarı kurallarını ve otomatik başlatmayı siler ve **sohbet geçmişinin de silinip silinmeyeceğini bir kez sorar** (varsayılan: sil; sessiz kaldırmada ve güncellemede veri silinmez). Bu bilgisayar sunucu olarak kullanıldıysa soru, tüm kullanıcıların hesaplarının ve mesajlarının da silineceğini söyler. **Bilinen sınır:** Standart bir kullanıcı kaldırmayı *başka bir yönetici hesabının parolasıyla* yükseltirse kaldırıcı o yönetici hesabının profiline bakar; kullanıcının otomatik başlatma kaydı ve verisi kalabilir. Bu durumda `%APPDATA%\ipchat-desktop` klasörünü elle sil.
- **Mac:** zip'i aç, `Ipchat.app`'i Uygulamalar'a at. İlk açılışta imzasız olduğu için engellenirse: uygulamaya sağ tıkla → *Aç*; "hasarlı" derse Terminal'de `xattr -cr /Applications/Ipchat.app` çalıştır. Tam temizlik için tepsi (menü çubuğu) menüsündeki **"Ipchat'i tamamen kaldır…"** kullanılır: sunucuyu durdurur, otomatik başlatmayı kaldırır, isteğe bağlı olarak sohbet geçmişini siler ve uygulamayı Çöp Kutusu'na taşır. (Uygulamayı yalnızca Çöp Kutusu'na atarsan sunucu süreci ve veri geride kalır.)
- Mesaj verisi şurada tutulur (Windows kaldırıcısı ve Mac "tamamen kaldır" menüsü silmeyi sorar): Windows `%APPDATA%\ipchat-desktop`, Mac `~/Library/Application Support/ipchat-desktop` (tamamen silmek için bu klasörü de sil).

**Sunucu olarak kullanım:** Uygulamayı aç, ağda sunucu bulamazsa çıkan ekranda **"Bu bilgisayar sunucu olsun"**a tıkla. Sunucu arka planda çalışır (pencere/terminal yok). Sistem tepsisinde (Mac'te menü çubuğunda) yeşil noktalı ikon ve **adres** görünür; ikona sağ tıklayıp adresi kopyalayabilirsin. Bu ayar hatırlanır, uygulama her açıldığında sunucu da başlar. Kapatmak için tepsi menüsünden "Sunucu modunu kapat". İlk açılan hesap yöneticidir.

**İstemci olarak kullanım:** Uygulama sunucuyu ağda kendisi bulur (UDP `41234`), bulunanı listede gösterir; bulamazsa adres elle yazılır. Sunucu bilgisayarında UDP `41234` ve TCP `3000` gelen bağlantıya açık olmalı (güvenlik duvarı izni istenirse *izin ver*).

**Bildirimler:** Yönetici olan kullanıcı, **oturum açıkken** biri kayıt olursa uygulamanın **bildirimini** alır (pencere kapalı/tepside olsa da; oturum açılmadan, örneğin bilgisayar yeni açıldığında, bildirim gelmez, giriş yapınca bekleyenler rozetle görünür). "Hesaplar" düğmesinde ve tepsi ikonunda bekleyen hesap sayısı rozeti görünür (Windows'ta ikon kırmızı noktalı olur ve üzerine gelince sayı yazar; Mac'te menü çubuğunda ve Dock'ta sayı). Kişi listesi ve bekleyen hesaplar **3 saniyede bir** kendiliğinden yenilenir.

**Kurum bilgisayarları:** Bilgisayarın güvenlik duvarı grup ilkesiyle (GPO) yönetiliyorsa yerel kurallar uygulanmaz ve başka cihazlar sunucuya bağlanamayabilir. Uygulama bunu fark edip bir uyarı gösterir ve tepside belirtir. Böyle bilgisayarlar **istemci** olarak sorunsuz çalışır; sunucuyu güvenlik duvarını yönetebildiğin bir bilgisayara kur.

**Genel:** Pencere sabit boyutlu (800x620). Kapatınca tepsiye iner; tamamen çıkmak için tepsi menüsünden "Çık". Aynı anda tek örnek çalışır. Kurulu uygulama bilgisayar açılışında başlar (tepsiden kapatılabilir).

**Derleme (geliştirici):** `.exe` ve Mac zip dosyaları GitHub'da otomatik üretilir: repoda **Actions → "Masaustu uygulamasi (Windows ve Mac)" → Run workflow**, bitince **Ipchat-Windows-Kurulum** ve **Ipchat-Mac** dosyaları indirilir. Geliştirme: `npm start -w desktop`; testler: `npm test -w desktop`.

## Eski kurulum yöntemi (kurulum.bat, yalnızca sunucu)

Masaüstü uygulaması yerine `kurulum.bat` ile de sunucu kurulabilir (Node.js'i kendisi kurar). Sunucu **pencere açmadan arka planda** çalışır:
- Durdurmak: `durdur.bat` — Elle başlatmak: `baslat-gizli.vbs`
- **Tamamen kaldırmak: `kaldir.bat`** (sunucuyu durdurur, otomatik başlatmayı, güvenlik duvarı kuralını ve masaüstü kısayolunu siler; klasörü ve Node.js'i silmez, onları elle silersin).

## Hesap onayı ve yönetici

- Sunucuda **ilk açılan hesap otomatik yönetici** olur ve doğrudan giriş yapar.
- Sonraki herkes kayıt olabilir ama hesapları **"onay bekliyor"** durumuna düşer; yönetici onaylayana kadar giriş yapamazlar.
- Yönetici, sohbet ekranında **Hesaplar** düğmesinden bekleyen hesapları onaylar/reddeder, hesapları kapatır/açar ve başka kullanıcıları yönetici yapabilir. Kapatılan kullanıcının açık oturumu hemen düşer.
- Tek yönetici şifresini kaybederse, sunucu bilgisayarında şu komut şifreyi sıfırlar ve hesabı yönetici yapar:

```bash
npm run reset-admin -- <kullanici-adi> <yeni-sifre>
```

- Testler: `npm test -w server`

## Elle kurulum (macOS / Linux / geliştirici)

```bash
# Node.js kurulu değilse (macOS, Homebrew ile):
brew install node

npm install
```

## Geliştirme modunda çalıştırma

```bash
npm run dev
```

Bu komut hem sunucuyu (`http://localhost:3000`) hem web istemcisini (`http://localhost:5173`) aynı anda başlatır.

## Production build (tek port, LAN kullanımı için)

```bash
npm run build   # web/dist üretir
npm start       # sunucu 3000 portunda hem API/socket hem de web/dist'i servis eder
```

Build sonrası LAN'daki diğer cihazlar sadece `http://<sunucu-ip>:3000` adresine gitmesi yeterlidir.

## Sunucunun LAN IP'sini bulma

- **macOS:** `ipconfig getifaddr en0` (WiFi arayüz adı farklıysa `en1`, `en2` deneyin) veya Sistem Ayarları > Ağ.
- **Windows:** `ipconfig` çalıştırıp "IPv4 Address" satırına bakın.

## Güvenlik duvarı

Sunucuyu çalıştıran makinede, seçtiğiniz portun (varsayılan `3000`) gelen bağlantılara (inbound) izin verdiğinden emin olun:

- **macOS:** Sistem Ayarları > Ağ > Güvenlik Duvarı, gerekirse Node.js'e izin verin.
- **Windows:** Windows Defender Güvenlik Duvarı > Gelen Kuralları, port 3000 için bir kural ekleyin.

## Kullanım

1. Tarayıcıdan sunucu adresine git (örn. `http://192.168.1.10:3000`) — bağlantı otomatik kurulur. (Sadece geliştirme modunda, 5173 portundaki Vite arayüzünde sunucu IP'si elle sorulur.)
2. İlk kullanımda kullanıcı adı + şifre ile kayıt ol.
3. Bu cihaz için 4 haneli hızlı giriş PIN'i belirle. Sonraki girişlerde sadece PIN yeterli.
4. Soldaki kişi listesinden biriyle veya "+ Yeni" ile oluşturduğun bir grupla sohbet et.
5. Ataç ikonuyla veya sürükle-bırak ile dosya/resim gönder.

## Mimari notu

Bu MVP; merkezi sunucu + web istemcisini kapsar. Web tarayıcısı ham UDP broadcast yapamadığı için sunucu adresi manuel girilir. Gerçek "ağı tara, sunucuyu otomatik bul" özelliği ve sistem tepsisi entegrasyonu, ileride eklenecek Electron tabanlı Windows masaüstü uygulamasına (Node `dgram` ile) bırakılmıştır.
