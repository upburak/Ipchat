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
