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

Kurulum istemeyenler sunucunun adresine gidebilir (örn. `http://192.168.1.10:3000`). Sayfa sunucudan servis edildiği için adres sorulmaz. Tarayıcıda masaüstüne özel şeyler çalışmaz: işletim sistemi bildirimi, tepsi ikonu ve sunucu keşfi yoktur. **Sunucu kimliği denetimi de yoktur** (bkz. "Sunucu kimliği"): tarayıcı yazılan adresi doğrudan açar, karşısındakinin gerçekten okulun sunucusu olup olmadığını denetlemez.

### Eski yöntem (yalnızca sunucu, Windows)

`kurulum.bat` ile Node.js'i kendisi kurup sunucuyu arka planda çalıştırabilir. Durdurmak `durdur.bat`, elle başlatmak `baslat-gizli.vbs`, kaldırmak `kaldir.bat`. Masaüstü uygulaması varken bu yola gerek yoktur.

---

## Kullanım

### İlk açılış

Ipchat'i ilk açtığında sohbet yerine bir **bilgilendirme ekranı** çıkar ("Ipchat'i kullanmaya başlamadan önce"). Ekran kısaca şunu söyler:

- Ipchat yalnızca okulun kendi yerel ağında çalışır; mesajlar ve dosyalar internete ya da bir buluta gitmez, yalnızca sunucu olarak seçilen bilgisayarda durur.
- Veri aynı ağ içinde **şifrelenmeden (açık) taşınır**; ağa girebilen ve araya girmeyi bilen biri okuyabilir. Kimlik doğrulama basittir (kullanıcı adı, şifre, cihaza bağlı PIN).
- Mesajlar ve hesaplar sunucu bilgisayarında durur; o bilgisayarı korumak ve yedeğini almak okulun sorumluluğundadır. Sunucu internete açılmamalıdır.
- Bu yüzden **hassas bilgiyi** (öğrenci kişisel verileri, sağlık ve kimlik bilgileri, sınav soruları, maaş ve banka bilgileri) Ipchat'ten göndermemelisin.
- Altta Ipchat'in kaldırıldığında ne sileceği yazar (yukarıdaki "Kaldırma ve veri" bölümüyle aynı kural).

**İlerlemek için iki ayrı kutuyu işaretlemen gerekir:** "Yukarıdaki sınırları okudum, anladım" ve "Kaldırma kuralını okudum, anladım". İkisi de işaretlenmeden **Devam et** düğmesi pasif kalır. **Çık** düğmesi yalnızca uygulamayı kapatır; hiçbir şey kaydedilmez, bir sonraki açılışta ekran yine çıkar. Onay verilmeden Ipchat sunucu aramaz, hiçbir sunucuya bağlanmaz, kayıtlı sunucu modunu başlatmaz, tepsi ikonu koymaz ve yeni bir otomatik başlatma kaydı eklemez.

Ekran **her kullanıcı için bir kez** çıkar. Bu sürüme ilk güncellemede de çıkar (aşağıdaki kutuya bak): 0.6.0'dan eski bir sürümden güncelleyen herkes, sunucu bilgisayarı dahil, onu bir kez görür. Sonraki güncellemelerde yeniden çıkmaz; yalnızca metnin içeriği önemli ölçüde değişirse ve sürüm numarası artırılırsa herkes yeniden onaylar. Onay ayar dosyasında tutulduğu için **her Windows kullanıcısı (profili) için ayrı** çıkar: aynı bilgisayarı iki kişi kendi hesabıyla kullanıyorsa ikisi de bir kez görür. Mac'te 0.5.0'daki kaldırma bildirimini görmüş olanlar da bu ekranı bir kez görür; eski bildirim kalktı, yerine bu ekran geldi.

> **Güncelleme günü, sunucu bilgisayarı için önemli (bu sürüme ilk güncellemede):** 0.6.0'dan eski bir sürümden güncellenen **sunucu bilgisayarında** ilk açılışta bu ekran çıkar ve **onaylanana kadar sunucu başlamaz; kimse bağlanamaz.** Yapılacaklar sırayla:
>
> 1. Sunucu bilgisayarını yeni sürüme güncelle.
> 2. **Önce o bilgisayarda** Ipchat'i aç (oturum açılınca kendiliğinden de açılır). Pencerede bu bilgilendirme ekranı görünür; **sunucu ise "Devam et"e basılana kadar başlamaz.** Ekran fark edilmezse kimse bağlanamaz, o yüzden sunucu bilgisayarının başına geçip ekrana bak.
> 3. İki kutuyu işaretleyip **"Devam et"e bas.** Sunucu ancak bundan sonra başlar.
> 4. Sonra diğer kullanıcılara haber ver; onlar da kendi bilgisayarlarında ekranı bir kez görür.
>
> Bu adım sonraki güncellemelerde gerekmez.

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

### Sunucu kimliği

Ipchat'in sunucusu ilk açıldığında kendine bir **kimlik** (bir anahtar çifti) üretir ve `server-data` klasöründe saklar. Masaüstü uygulaması bağlandığı sunucuyu bu kimlikle **tanır ve hatırlar**. Sohbet sayfasını açmadan önce sunucuya bir "kimlik sorusu" sorar ve yanıtın, o kimliğin gizli anahtarıyla imzalandığını denetler. Böylece kendini sunucu diye **tanıtan** ama gizli anahtarı bilmeyen bir bilgisayar (örneğin ağda yeni kurulmuş ikinci bir Ipchat sunucusu) yakalanır ve uyarı ekranı çıkar. Kimlik adrese (IP) bağlı değildir, yani sunucunun adresi değişse bile aynı sunucu olarak tanınır. **Bu denetim her kötü niyeti durdurmaz;** neyi durdurmadığı aşağıdaki kutuda ve "Sınırlar"da yazılı.

- **İlk bağlantıda soru sorulmaz.** Daha önce hiçbir sunucu hatırlanmadıysa uygulama bağlandığı sunucunun kimliğini sessizce kaydeder. Ağda **tam bir** sunucu bulunursa seçim listesi de gösterilmez: uygulama ona kendiliğinden bağlanır ve hatırlar. Liste yalnızca **iki ya da daha çok** sunucu bulunursa çıkar ve hangisine bağlanacağını sen seçersin.
- Sunucu modunu açan bilgisayar kendi sunucusunun kimliğini kendi klasöründen okuyup denetler ve soru sormadan hatırlar.
- Bir kez hatırlanan kimlik, sonraki bağlanışlarda her seferinde denetlenir. Eşleşiyorsa hiçbir şey görmezsin.

**"Bu sunucu daha önce bağlandığın sunucu değil" ekranı.** Bağlandığın sunucunun kimliği hatırlananla **farklıysa** (ve ağda hatırlanan kimliği taşıyan başka bir sunucu bulunamadıysa) uygulama bağlanmadan önce bu ekranı gösterir, sunucunun adını, adresini ve kısa bir kimlik kodunu (`A1B2-C3D4-E5F6` gibi) yazar. İki düğme vardır:

- **Vazgeç** (önerilen, varsayılan): bağlanmaz, adres/sunucu seçme ekranına döner. Bu ekranı beklemiyorsan bunu seç; ağdaki başka bir bilgisayar sunucu gibi davranıyor olabilir.
- **Bağlan ve yeni sunucuyu hatırla:** yalnızca sunucu bilgisayarının **değiştirildiğini** ya da Ipchat'in **yeniden kurulup verilerin silindiğini** biliyorsan seç. Eski kimlik silinir, yenisi hatırlanır; ekran bir daha çıkmaz.

Eski sürümde (0.6.0'dan önce) çalışan bir sunucu kimlik veremez. Daha önce kimlik hatırlanmadıysa ona bağlanmaya devam edilir; kimliği hatırlanmış bir istemci kimliksiz bir sunucuya gelirse aynı ekran ("Bu sunucu kimlik bilgisi vermiyor (eski sürüm olabilir)") çıkar. Bu yüzden kimlik açısından güncelleme sırası önemli değildir (hiçbir sırada uyarı beklenmez); ekran yalnızca sunucu eski sürüme geri alınırsa çıkar. (Bu, yukarıdaki "İlk açılış" onayından ayrı bir konudur: o, bu sürüme ilk güncellemede her kullanıcıda, sunucu bilgisayarında da bir kez gerekir.)

**Yalnızca bir kimlik hatırlanır.** İki ağ arasında taşınan bir dizüstü (okul ile ev) ya da bir sunucudan öbürüne geçen bilgisayar her geçişte bu ekranı görür; bu beklenen davranıştır. Aynı şekilde tepsi menüsündeki **"Başka bir sunucuya bağlan…"** (eski adıyla "Sunucuyu değiştir") ve **sunucu modunu kapatmak hatırlanan kimliği de siler** (hatırlanan adresle birlikte), yani bundan sonra bağlandığın ilk sunucu soru sorulmadan hatırlanır.

> **Ne yapar, ne yapmaz:** kimlik denetimi, kimlik sorusunu yanıtlayanın sunucunun gizli anahtarını bildiğini kanıtlar. Ama ağdaki bir bilgisayar bu soruyu **gerçek sunucuya iletip** yanıtı aynen geri verirse denetimden geçer ve ardından kullanıcıya **kendi giriş sayfasını** gösterip şifreyi toplayabilir. Bunun için cihazların arasına girmesi gerekmez; sunucu aramasına yanıt vermesi yeter. Özellikle hatırlanan adres yanıt vermediğinde (sunucunun adresi değişti ya da sunucu yeniden başlıyor) uygulama, ağda bu kimliği doğrulayan **ilk adaya** sorusuz bağlanır; hangi adayın önce geldiğini yanıtların sırası belirler. Kimlik denetimi trafiği **şifrelemez** de. Bu ikisini kapatmak sonraki bir iştir: sunucunun hangi adresten sorulduğunu da imzalaması (**kanal bağlama**) ve **şifreleme** (bkz. Sınırlar).

---

## Kaldırma ve veri

Kaldırırken **ne silineceği sorulmaz**. Ne silineceği şudur:

- **Çalışanların (istemci) bilgisayarında her şey silinir:** program, ayarlar, otomatik başlatma, kayıt defteri girdileri, güvenlik duvarı kuralları ve `ipchat-desktop` veri klasörünün tamamı. Bu işlem geri alınamaz. (İstisnalar aşağıda: Windows'taki "Bilinen sınır" ve Mac'te uygulamayı yalnızca Çöp Kutusu'na atmak.)
- **Sunucu olan bilgisayarda da aynı şeyler silinir, yalnızca hesaplar ve mesaj geçmişi silinmez.** Bunlar `server-data` klasöründe durur. İstersen bu klasörü elle silebilirsin. Windows'ta kaldırma bittiğinde Ipchat bu klasörün nerede olduğunu sana söyler (sessiz kaldırmada mesaj çıkmaz); Mac'te yol, onay penceresinde kaldırmadan önce görünür ve sonrasında bir şey çıkmaz. Windows'ta çok nadir olarak klasör geri konamazsa hesaplar ve mesajlar `%APPDATA%\ipchat-server-data-tmp` klasöründe kalır. Ipchat'i bir sonraki açışında bunu sana bir pencereyle söyler ve o klasörü **kendiliğinden silmez**. Geri almak için: Ipchat'i kapat; `%APPDATA%\ipchat-desktop` klasöründe yeni, boş bir `server-data` oluşmuşsa onu sil; sonra `ipchat-server-data-tmp` klasörünü `%APPDATA%\ipchat-desktop` içine taşı ve adını `server-data` yap. (Dosya Gezgini adres çubuğuna `%APPDATA%` yazarak o klasöre gidebilirsin.)
- **Güncelleme sırasında hiçbir şeye dokunulmaz.** Yeni sürümü üstüne kurmak ayarları ve mesajları silmez. (Bu, silme konusudur; 0.6.0'a ilk güncellemede çıkan bir kerelik ilk açılış ekranı için "İlk açılış" bölümüne bak.)

`server-data` klasörü: Windows `%APPDATA%\ipchat-desktop\server-data`, Mac `~/Library/Application Support/ipchat-desktop/server-data`.

### Yedek almak

Hesapları ve mesaj geçmişini yedeklemek için **`server-data` klasörünün tamamını** kopyala (USB'ye, başka bir klasöre). Geri almak için aynı klasörü yerine koy.

**Sunucuyu yeni bir bilgisayara taşırken** `server-data` klasörünün tamamını taşı: **sunucunun kimliği de onunla gelir** ve kullanıcılar hiçbir uyarı görmez. Klasör taşınmazsa yeni sunucu yeni bir kimlik üretir ve **her kullanıcı "Bu sunucu daha önce bağlandığın sunucu değil" ekranını bir kez görür** (bkz. "Sunucu kimliği"). Aynısı `server-data` silinirse de olur.

> **Eski yedeği geri koyarken dikkat:** 0.6.0'dan **önce** alınmış bir yedekte kimlik dosyaları (`identity.key`, `identity.pub`) yoktur. Böyle bir yedeği `server-data` yerine koyarsan sunucu açılışta **yeni bir kimlik** üretir ve **her kullanıcı "Bu sunucu daha önce bağlandığın sunucu değil" ekranını bir kez görür.** Kullanıcılara önceden haber ver.
>
> **Yarım geri yükleme:** `identity.pub` dosyası geri konup `identity.key` konmazsa (ya da `identity.key` bozuksa) sunucu **başlamaz**; yeni kimlik üretmez, hiçbir dosyayı silmez. Ipchat bunu "Sunucu başlatılamadı: sunucunun kimlik dosyası bozuk ya da eksik." penceresiyle söyler ve ne yapılacağını adım adım yazar: `server-data`'yı silme; tam yedekten iki kimlik dosyasını birlikte geri koy; yedek yoksa ikisini klasörden başka bir yere taşı (o zaman yukarıdaki gibi herkes bir kez değişim ekranını görür).

> **Yedeği koru:** kimliğin gizli anahtarı `server-data` içindeki **`identity.key`** dosyasındadır, yani yedeğin içinde de bulunur. Yedeği eline geçiren biri sunucuyu taklit edebilir; yedek diski/USB'yi güvende tut.

> **Dikkat:** içindeki `ipchat.db` dosyası tek başına kopyalanmaz. Uygulama açıkken bu dosya boş (4 KB) görünebilir; son kayıtlar yanındaki `ipchat.db-wal` dosyasında durur. Yalnızca `ipchat.db`'yi kopyalarsan yedek eksik olur. **Klasörün tamamını kopyala**, en güvenlisi de uygulama kapalıyken kopyalamaktır.

- **Windows:** Ayarlar → Uygulamalar → Ipchat → Kaldır. Kural kurulumun sonunda bir kez, kaldırma bittiğinde bir kez daha yazılır. Sessiz kaldırma da aynı şeyleri siler, yalnızca ekrana mesaj çıkarmaz.
  **Bilinen sınır:** standart bir kullanıcı kaldırmayı başka bir yönetici hesabının parolasıyla yükseltirse kaldırıcı o hesabın profiline bakar; kendi verisi kalabilir. O zaman `%APPDATA%\ipchat-desktop` klasörünü elle sil.
  Aynı şey **birkaç kişinin kullandığı bilgisayarda** da olur: kaldırıcı yalnızca kaldırmayı yapan hesabın verisini ve otomatik başlatma kaydını temizler; diğer kullanıcıların her birinde kendi `%APPDATA%\ipchat-desktop` klasörü ve otomatik başlatma kaydı kalır. Onları o kullanıcılar kendi hesaplarından elle silmelidir.
- **Mac:** Mac'te kurulum adımı yoktur, o yüzden bu kural uygulama **ilk açıldığında**, yukarıdaki "İlk açılış" ekranında yazılır. Kaldırmak için tepsi menüsünden **"Ipchat'i tamamen kaldır…"** seçilir. Çıkan onay penceresi aynı kuralı tekrar anlatır; seçili düğme **Vazgeç**'tir. Uygulamayı yalnızca Çöp Kutusu'na atarsan sunucu süreci ve veri geride kalır.

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
2. GitHub'da **Releases → Draft a new release**, etiket olarak `test-0.6.1` gibi bir ad yaz ve yayınla.
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

**Sırada:** **kanal bağlama ve trafiğin şifrelenmesi** (sunucu kimliğinin üzerine kurulacak; sunucunun hangi adresten sorulduğunu da imzalaması, soruyu gerçek sunucuya ileten bir bilgisayarı yakalamak için), ardından bilgisayarlar arası **dosya paylaşımı**. Tasarım belgeleri `docs/superpowers/specs/` içindedir.

---

## Sınırlar

- Yalnızca yerel ağ. HTTPS yok, sunucu internete açılmamalı.
- Sunucu kimliği, kimlik sorusunu yanıtlayanın sunucunun gizli anahtarını bildiğini kanıtlar; yalnızca kendini sunucu diye **tanıtan** bir bilgisayarı (örneğin yeni kurulmuş ikinci bir sunucuyu) yakalar. **Soruyu gerçek sunucuya iletip kendi sayfasını gösteren bir bilgisayarı durdurmaz** (bkz. "Sunucu kimliği"), **trafiği şifrelemez** ve ağı dinleyen birini durdurmaz. Bunlar sonraki işin konusudur: **kanal bağlama** (sunucunun hangi adresten sorulduğunu da imzalaması) ve **şifreleme**. Dosya paylaşımı ondan önce açılmayacak.
- İlk bağlantıda (hiçbir sunucu hatırlanmıyorken) kimlik sorusuz kaydedilir; o anda bağlanılan sunucu sahteyse onun kimliği hatırlanır. Ağda tek sunucu bulunursa liste de gösterilmez ve ona otomatik bağlanılır; yani o sırada ağda yalnızca kötü niyetli bir bilgisayar yanıt veriyorsa ona bağlanılır.
- Kimlik denetimi, uygulamanın **kendi başlattığı yüklemeleri** kapsar (açılış, sunucu seçimi, arka plandaki yeniden deneme, yükleme hatasından sonra yeniden bağlanma). Pencere içinde sayfayı yenilemek ya da bağlantı kopup kendiliğinden yeniden kurulması yeniden denetlenmez (bilinen sınır).
- **Otomatik güncelleme yok.** Yeni sürümler elle kurulur (bilerek böyle bırakıldı). Bu sürüme (0.6.0) ilk güncellemede sunucu bilgisayarında önce "Devam et"e basılması gerekir, yoksa sunucu başlamaz; sonraki güncellemelerde gerekmez (bkz. "İlk açılış").
- Sunucu olan bilgisayar açık ve oturumu açık olmalı.
- Mac uygulaması Apple tarafından onaylı (notarized) değil; her indirmede karantina adımı gerekir.
- Mesaj geçmişi yalnızca sunucu bilgisayarındadır ve kendiliğinden yedeklenmez — yedeği elle alman gerekir (yukarıdaki "Yedek almak").
- Giriş ekranı kayıtlı kullanıcıları listelemez; herkes kendi kullanıcı adını yazar. Kaldırma cihaz kaydını da sildiği için PIN'le hızlı giriş sıfırlanır: yeniden kurulumdan sonra herkes bir kez kullanıcı adı + şifreyle girip yeni PIN belirler.
