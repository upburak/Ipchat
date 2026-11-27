# Sunucu Kimliği (anahtar sabitleme)

Tarih: 2026-11-26
Durum: onaylandı (kullanıcı, 2026-11-26); 0.6.0 için kodlandı, `main`'e alınmadı; yalnızca CLAUDE.md "0.6.0'da kodlandı" bölümünde yazıldığı kadar denendi (saf mantık otomatik testle, HTML sayfaları Linux'ta Playwright ile; Electron kabuğu ve gerçek bilgisayar denemesi yok). Son incelemeden sonra korumanın sınırı (canlı aktarma, R6 kararı) §11'de yazıldı.
İlgili: `2026-11-13-ipchat-dosya-paylasimi-design.md` (bu iş onun önkoşuludur), `2026-11-26-temiz-kaldirma-design.md`

## 1. Amaç ve neden

Uygulama bugün sunucuyu **yalnızca adresinden** tanıyor. `config.json` içinde `lastServer: "http://192.168.1.10:3000"` gibi bir adres duruyor; açılışta o adrese sorulur, yanıt `{ "app": "ipchat" }` diyorsa kabul edilir. Kimlik diye bir şey yok. Ağdaki herhangi bir bilgisayar Ipchat sunucusu çalıştırırsa uygulama ona da aynı güvenle bağlanır ve **kullanıcı adıyla şifreyi oraya yazar**. Keşif de UDP yayınına gelen **ilk geçerli yanıta** güvendiği için aynı kapıdan geçer.

Dosya paylaşımı gelince aynı kapı idari dosyaları yanlış bilgisayara akıtır. Bu yüzden bu iş ondan önce yapılır.

Bu belge **sunucunun kendisini kanıtlamasını** ve uygulamanın tanıdığı sunucuyu **hatırlamasını** tanımlar. Trafiğin şifrelenmesi ayrı bir iştir (bkz. 3 ve 10).

## 2. Hedefler

- Uygulama, bağlandığı sunucunun **daha önce bağlandığı sunucu olduğunu** her bağlanışta doğrular.
- Ağda başka biri aynı adla ya da aynı adreste sahte bir Ipchat sunucusu açarsa uygulama **bağlanmadan önce** durur ve kullanıcıyı uyarır. Sahte sunucu kimliği **kopyalayarak** taklit edemez. *(Son incelemeden sonra not: kimlik sorusunu gerçek sunucuya **ileten** bir aktarıcı bu işle yakalanmaz; bkz. §11.)*
- Normal kullanımda kullanıcıya **hiçbir ek iş çıkmaz**: ilk bağlanışta sorusuz hatırlanır, sonra fark edilmez.
- Sunucunun IP adresi değişse (DHCP) kimlik aynı kalır, kimse uyarı görmez.
- Sunucu yeniden kurulursa ya da sunucu bilgisayarı değişirse (`server-data` korunduysa) kimlik **aynı kalır**; kimse uyarı görmez.
- Kimlik gerçekten değişirse her kullanıcı **bir kez** sorulur ve onaylayarak devam eder.

## 3. Kapsam dışı

- **Trafiğin şifrelenmesi.** Kimlik doğrulamak şifrelemek değildir. Mesajlar ve şifreler ağda hâlâ açık taşınır; bu, projenin başından beri kabul edilmiş sınırdır ve ilk açılış ekranında yazar. Şifreleme, sunucunun bu belgedeki anahtarına dayanarak, **ayrı bir iş olarak** dosya paylaşımı gerçek dosya taşımaya başlamadan önce yapılacaktır. Bu belge onu **mümkün kılar** ama yapmaz.
- Tarayıcıdan girenler (tarayıcı sayfayı zaten adresten açıyor; sabitleme masaüstü uygulamasının işidir).
- Sertifika, sertifika kurumu, HTTPS. (Anahtar sabitleme bunların yerini tutar; belirtilmiş sınır "LAN'da HTTPS yok" korunur.)
- Anahtar yenileme/döndürme, yöneticinin uzaktan kimlik sıfırlaması, birden fazla sunucuyu aynı anda hatırlamak.
- Kimliğin kullanıcıya parmak izi olarak gösterilip elle karşılaştırılması (Signal tarzı). İleride eklenebilir, bu işin parçası değil.

## 4. Anti-hedefler

- Kimlik değişikliğinin sessizce kabul edilmesi ("uyarı çıkmasın" diye). Bu, korumayı anlamsız kılar.
- Sunucu bilgisayarında kaldırma ya da güncelleme sırasında kimliğin kaybolması (herkese uyarı çıkarmak demektir).
- Kullanıcıdan bir kod, parmak izi ya da anahtar okuyup yazmasını istemek.
- Yeni bir bağımlılık, sertifika yönetimi ya da internet erişimi.

## 5. Kısıtlar

- Yalnızca `node:crypto` (Node içinde, ek paket yok). Mevcut yığın: Express, Socket.IO, `node:sqlite`, Electron 45.3.2.
- Sunucu `server-data` klasörünü zaten kaldırmada koruyor (0.5.0); kimlik **o klasörde** durmalı, böylece aynı koruma ona da uygulanır.
- Eski sunucular (0.5.0 ve öncesi) bu uca sahip değil; karışık sürümlü bir okul ağında güncelleme sırası belirsizdir (bkz. 7.6).
- Uygulama Electron'a bağlı kısımlar (`main.js`, `connect.html`) otomatik testle kapsanmaz; kimlik mantığı saf modüllere ayrılır ve onlar test edilir.

## 6. Yaklaşımlar

- **A. Sunucu bir numara üretir, uygulama hatırlar.** Basit, ama numara **kopyalanabilir**: sahte sunucu gerçek sunucuya "numaran ne?" diye sorup aynısını söyleyebilir. Kaza önler (IP değişimi, ikinci sunucu), kasıtlı sahtecilik önlemez. Elendi.
- **B. Sunucu bir anahtar çifti üretir ve her bağlanışta imza atar (seçildi, kullanıcı onayladı).** Gizli yarı yalnızca sunucu bilgisayarında kalır; uygulama her bağlanışta rastgele bir soru gönderir, sunucu imzalar, uygulama hatırladığı açık anahtarla doğrular. Açık anahtarı kopyalayan biri imza atamaz.
- **C. HTTPS ve sertifika.** Trafiği de şifreler, ama sertifika kurumu ya da elle kurulan sertifika ister; tarayıcıda uyarı çıkarır, yenileme gerektirir ve "LAN'da HTTPS yok" kısıtına aykırıdır. Elendi.

**Neden sertifika gerekmiyor:** sertifika, sunucuyu **daha önce hiç görmemiş** birine tanıtmak içindir. Burada uygulama sunucuyu bir kez görüp hatırlıyor ("ilk gördüğüne güven, sonra değişirse uyar"; SSH böyle çalışır). Sertifika kurumu, yenileme ve ücret yok.

## 7. Kararlar

### 7.1 Anahtar ve kimlik

- Sunucu ilk açılışında **Ed25519** anahtar çifti üretir (`node:crypto`). Gizli anahtar sunucu bilgisayarından **hiç çıkmaz**; açık anahtar herkese söylenir.
- **Parmak izi** = açık anahtarın SHA-256 özeti. Kullanıcıya gösterilmesi gerekirse `A1B2-C3D4-E5F6` biçiminde kısa bir kısmı gösterilir.
- Anahtar `server-data` (sunucunun veri klasörü) içinde saklanır. Bu, 0.5.0'ın kaldırma korumasına otomatik dahil olur: **sunucu kaldırılıp yeniden kurulsa kimlik aynıdır**. `server-data` başka bilgisayara kopyalanırsa kimlik de taşınır; sunucu bilgisayarını değiştirmek kimseye uyarı çıkarmaz.
- Anahtar yalnızca dosya yoksa üretilir; mevcut bir anahtar asla sessizce yeniden üretilmez. Dosya bozuksa sunucu **yeni anahtar üretmek yerine hata verip durur** ve yöneticiye yazar (sessiz kimlik değişimi anti-hedeftir).

### 7.2 Doğrulama akışı

1. Uygulama 32 baytlık rastgele bir **sınama değeri** (nonce) üretir.
2. Sunucunun kimlik ucuna sorar: sunucu açık anahtarı ve `"ipchat-kimlik-v1:" + nonce` mesajının imzasını döner.
3. Uygulama imzayı yanıttaki açık anahtarla doğrular ve **açık anahtarın parmak izini** hatırladığı parmak izi ile karşılaştırır.
4. Her bağlanışta yeni nonce kullanılır: eski bir yanıt kaydedilip tekrar oynatılamaz. Mesaj önekindeki sabit metin, imzanın başka bir amaçla kullanılmasını önler.

Sonuç beş durumdan biridir: **tanıdık** (devam), **yeni** (hiç kimlik hatırlanmıyor, sorusuz hatırla ve devam et), **değişmiş** (7.4), **desteklenmiyor** (eski sunucu, 7.6), **geçersiz** (imza tutmuyor ya da yanıt bozuk; bağlanma, kullanıcıya "Bu sunucunun kimliği doğrulanamadı" de).

### 7.3 Nerede doğrulanır

Doğrulama **masaüstü uygulamasının ana sürecinde**, sohbet sayfası sunucudan yüklenmeden önce yapılır. Doğrulanmamış bir sunucunun sayfası pencerede hiç çalışmaz. Aynı doğrulama:

- kayıtlı sunucuya otomatik bağlanırken,
- kullanıcı listeden ya da elle adres yazarak sunucu seçtiğinde,
- keşif sonuçları arasından kayıtlı sunucu aranırken (adres değişmiş olabilir; **kimliği tutan** sunucu seçilir),
- arka planda yeniden bağlanırken

çalışır. Doğrulama tek bir saf modülden (`verifyServer`) geçer; dosya paylaşımı ajanı da ileride aynı modülü kullanır.

*(Bilinen sınır: "canlı aktarma" bu işle kapanmaz. Ağdaki herhangi bir bilgisayar keşfe yanıt verip kimlik sorusunu gerçek sunucuya iletirse doğrulamadan geçer ve sonra kendi sayfalarını gösterebilir; bunun için cihazların arasına girmesi gerekmez. Bu belge yalnızca kendini sunucu diye **tanıtan** ama gizli anahtarı bilmeyen bir bilgisayarı yakalar. Ayrıntı ve sonraki adım: §11. Kullanıcıya trafiğin açık taşındığı ilk açılış ekranındaki metinle zaten söylenir.)*

### 7.4 Kimlik değiştiğinde (kullanıcının seçimi: bir kez sor, onaylayınca devam)

Doğrulama başarılı ama parmak izi hatırlananla **farklıysa** bağlanmadan önce bir onay ekranı çıkar:

> **Bu sunucu daha önce bağlandığın sunucu değil.**
>
> Sunucu bilgisayarı değiştirildiyse ya da Ipchat yeniden kuruldu ve veriler silindiyse bu normaldir. Böyle bir şey beklemiyorsan **bağlanma**; ağdaki başka bir bilgisayar sunucu gibi davranıyor olabilir.
>
> Sunucu: *<bilgisayar adı>* (*<adres>*)
>
> [ Vazgeç ] [ Bağlan ve yeni sunucuyu hatırla ]

Varsayılan düğme **Vazgeç**. "Bağlan" denirse yeni parmak izi hatırlanır; eskisi silinir. Aynı ekran **bir kez** çıkar, sonraki bağlanışlarda yeni kimlik tanıdıktır.

*(Benim kararım: ekran işletim sistemi mesaj kutusu yerine uygulamanın kendi `connect.html` sayfasında gösterilir; Mac'te pencere gizliyken mesaj kutusunun hiç görünmemesi 0.3.0'da yaşanmış bir tuzaktı, kendi sayfamız bunu çözer.)*

Değişiklik ekranı **bağlanmaya engel olmaz ama bağlanmayı zorunlu da kılmaz**: Vazgeç denirse uygulama, 7.5'teki gibi seçim ekranına döner.

### 7.5 Keşifte seçim

Keşif birden fazla sunucu bulursa bugünkü gibi seçim ekranı çıkar; fark: her aday doğrulanır, **kayıtlı kimliği taşıyan sunucu öne çıkarılır ve otomatik seçilir**, kimliği tanınmayanlar "Tanımadığın sunucu" etiketiyle gösterilir. Kayıtlı kimliği taşıyan sunucu bulunamıyor ama başka sunucular var ise 7.4 ekranı gösterilir.

> **Düzeltme (2026-11-27, kullanıcı isteği, ilk gerçek denemeden sonra):** hatırlanan sunucu **yokken** keşif **tam bir** sunucu bulursa (kimlik doğrulanmış ya da eski/kimliksiz), seçim listesi **gösterilmez**: uygulama o sunucuya bağlanır ve kimliği varsa sorusuz hatırlar. Seçim listesi yalnızca **iki ya da daha çok** aday bulunursa çıkar. Gerekçe: kullanıcı "en az iş" ister ve ilk açılış onayı zaten verildiği için ikinci bir tıklama yarar sağlamıyordu; ayrıca bu kural, ilk gördüğüne güven (§6) ilkesiyle tutarlıdır. Bilinen bedel: ağda yalnızca kötü niyetli bir sunucu yanıt verirse (gerçek sunucu kapalıyken) ona otomatik bağlanılır ve kimliği hatırlanır; liste gösterilse de kullanıcı adı yalnızca bir ad olduğundan koruma zayıftı. Önceki davranış (tek aday için de liste) 0.5.0'dan devralınmıştı.

### 7.6 Eski sunucular ve sürüm karışıklığı

Kimlik ucu olmayan bir sunucu (0.5.0 ve öncesi) için:

- **Hatırlanmış kimlik yoksa:** bağlanılır (bugünkü davranış), hiçbir şey hatırlanmaz.
- **Hatırlanmış kimlik varsa:** bunu "kimlik değişti" gibi ele al (7.4). Aksi halde saldırgan "eski sürümüm" diyerek korumayı atlatırdı (sürüm düşürme).

Güncelleme sırası: **önce sunucu bilgisayarı, sonra istemciler** (ya da tersi). İstemci önce güncellenirse hatırlanmış kimlik olmadığı için eski sunucuya bağlanmaya devam eder; sunucu güncellenince ilk bağlanışta kimlik hatırlanır. Kimlik yalnızca bir kez **görüldüğünde** hatırlandığı için hiçbir güncelleme sırası uyarı çıkarmaz. Uyarı yalnızca sunucu **eski sürüme geri alınırsa** çıkar. *(Benim kararım.)*

### 7.7 Kendi sunucusunu barındıran bilgisayar

Sunucu modunu açan bilgisayar kendi sunucusuna (`127.0.0.1`) bağlanır. Bu bilgisayar o sunucunun sahibidir: kendi alt sürecini başlattığı için o kimlik **sorulmadan** hatırlanır (7.4 ekranı çıkmaz). *(Benim kararım: aksi halde yönetici kendi `server-data`'sını sildikten sonra kendi bilgisayarında kendi sunucusu için uyarı görürdü.)*

### 7.8 Keşif yanıtı

UDP keşif yanıtına (`{app, port, name}`) **parmak izi eklenir**, yalnızca adayları ayırt etmek içindir. Bu yanıt imzasızdır ve **güvenilmez**; asıl karar her zaman 7.2'deki imzalı doğrulamayla verilir. Saldırgan keşif yanıtında doğru parmak izini yazabilir; imzayı kendisi atamaz, ama soruyu gerçek sunucuya iletip onun imzasını geri verebilir (§11).

### 7.9 İnceleme sonrası netleştirmeler (benim kararlarım)

1. **Kayıtlı adres farklı kimlikle yanıt verirse** (DHCP adresi başka bir bilgisayara geçmiş olabilir) hemen uyarı **çıkmaz**: önce keşif çalışır. Kayıtlı kimliği taşıyan bir sunucu bulunursa oraya bağlanılır ve adres güncellenir, kullanıcı hiçbir şey görmez. Hiçbir aday kimliği taşımıyorsa 7.4 ekranı gösterilir. Böylece adres değişimi yanlış alarm üretmez (2. hedef). Bu, `resolveServer` akışına "başka adreste bulundu" sonucunu ekler.
2. **Kendi sunucusunu barındıran bilgisayar** (7.7): ana süreç, kendi `server-data` klasöründeki **açık anahtarı doğrudan dosyadan okur** ve `127.0.0.1` yanıtının bununla eşleşmesini ister. Aynı portu başka bir süreç tutarsa eşleşmez ve bağlanılmaz. Açık anahtar, ana sürecin okuyabileceği ayrı ve gizli olmayan bir dosyada (ya da gizli dosyadan türetilebilir biçimde) durur; gizli anahtarı **yalnızca sunucu süreci** okur.
3. **Masaüstü dışı sunucular** (eski `kurulum.bat` yöntemi, `npm run dev`): kimlik ucu sunucu kodunun kendisindedir, bu yüzden onlarda da çalışır. Anahtar `ipchat.db`'nin bulunduğu klasörde (`IPCHAT_DATA_DIR` nereyi gösteriyorsa) durur; kimlik ile hesaplar **aynı kaderi paylaşır**: o klasör silinirse ikisi birlikte gider. `.bat` betiklerine dokunulmaz.
4. **Tek yuva sınırı**: yalnızca bir kimlik hatırlanır. Okul ile ev arasında taşınan bir dizüstü ya da sunucu modunu kapatıp başka sunucuya bağlanan bir bilgisayar, her geçişte 7.4 ekranını görür. Kabul edilir. Tek istisna: `disableServerMode` zaten `lastServer`'ı sildiği için **hatırlanan kimliği de siler**; yoksa sunucu modunu kapatan yönetici kendi eski sunucusu yüzünden uyarı görürdü.
5. **Eski sunucu ve "Bağlan"** (7.6): kimliği hatırlanmış bir istemci kimliksiz sunucuya bağlanmaya onay verirse hatırlanan kimlik **silinir** (kullanıcı kararı bilerek verdi; yeni bir kimlik yok, tutulacak bir şey de yok). Ekran metni bu durumda farklıdır: *"Bu sunucu kimlik bilgisi vermiyor (eski sürüm olabilir)"*. Keşifte yalnızca tanınmayan sunucular bulunursa bugünkü **seçim listesi** gösterilir; kullanıcı birini seçince o aday için 7.4 ekranı çıkar (aday başına bir uyarı değil, **seçilen** için bir uyarı).
6. **Yeniden doğrulamanın kapsamı**: yalnızca **ana sürecin yaptığı yüklemeler** (ilk bağlanış, 3 sn'lik arka plan yeniden deneme, `did-fail-load` sonrası yeniden yükleme). Sayfa içinde yenileme ya da Socket.IO'nun sunucu değişimi sonrası kendiliğinden yeniden bağlanması **kapsanmaz**; bunu yakalamak gezinme olaylarına bağlanmayı ve sürekli doğrulamayı gerektirir ve ayrı, daha büyük bir iştir. Bilinen sınır olarak belgelenir; şifreleme işi (10) bunu kapatır.

## 8. Builder'a bırakılanlar

Kimlik ucunun yolu ve yanıt biçimi (öneri: mevcut `/api/health` yanıtına dokunmadan yeni bir `GET /api/identity?nonce=…`), anahtarın dosyada saklanma biçimi ve izinleri (gizli anahtar dosyasını yalnızca sunucu sürecinin okuyabilmesi, Windows'ta sınırlı), ayar dosyasında hatırlanan kimliğin alan adı ve biçimi, parmak izinin gösterim biçimi, `connect.html`'deki 7.4 ekranının görünümü, doğrulamanın zaman aşımı (mevcut `isReachable` 1500 ms kullanıyor), hatalı yanıtların (çok büyük gövde, yanlış tür) kesin sınırları.

**Testle kapsanacak saf mantık** (`node:test`, yeni kütüphane yok): anahtar üretimi ve aynı dosyadan aynı kimliğin okunması; bozuk dosyada yeni anahtar **üretilmemesi**; imzanın doğrulanması ve farklı nonce ile **tutmaması**; beş sonuç durumunun doğru ayrılması (özellikle: hatırlanan kimlik + kimlik ucu yok → "değişmiş", sürüm düşürme); keşifte kayıtlı kimliğin seçilmesi; parmak izi biçimi. Elektron'a bağlı kısımlar (`main.js`, `connect.html`) otomatik denenmez; bu kısım gerçek bilgisayarda elle denenecektir.

## 9. Riskler

- **Kimlik kaybı herkese uyarı çıkarır.** Yönetici `server-data` klasörünü silerse (bilerek ya da yedeksiz bir bilgisayar değişiminde) yeni anahtar üretilir ve **her kullanıcı bir kez** 7.4 ekranını görür. Bu beklenen ve istenen davranıştır (sunucu gerçekten değişti), ama müdür bilgisayarı değiştirirken `server-data`'yı taşımayı unutursa 40 kişi aynı ekranı görür. README'deki yedek alma bölümüne "yeni bilgisayara geçerken `server-data` klasörünü taşı, kimlik de onunla gelir" eklenir.
- **Gizli anahtar sunucu bilgisayarında düz dosya.** Yedek alan biri (README yedeğin klasörün tamamı olmasını söylüyor) anahtarı da yedekler; yedeği ele geçiren biri sunucuyu taklit edebilir. Sınır olarak belgelenir; yedeğin korunması okulun sorumluluğudur (ilk açılış ekranında zaten yazıyor).
- **Sahte "değişti" ekranı alışkanlığı.** Kullanıcılar ekranı okumadan "Bağlan"a basmayı öğrenirse koruma işlemez. Bu yüzden ekran **nadir** çıkmalı (7.1/7.7'deki korumalar bunun içindir) ve varsayılan düğme Vazgeç olmalıdır.
- **Doğrulama ile yükleme arasındaki boşluk** (7.3) şifreleme işine kadar açık kalır.
- Mac'te bu akış gerçek bir Mac'te denenmeyecek (okulda Mac yok).

## 10. Sonraki iş (not)

Şifreleme (kimliği doğrulanmış sunucuyla şifreli konuşma), dosya paylaşımı gerçek dosya taşımadan önce ayrı bir tasarımla yapılır. Bu belgenin anahtarı ona zemin olur; ondan önce dosya paylaşımı açılmamalıdır.

## 11. Sonuç / bilinen sınır (son incelemeden sonra)

Uygulanan doğrulama şunu kanıtlar: kimlik sorusunu (`/api/identity?nonce=`) yanıtlayan, sunucunun gizli anahtarını biliyor. Bu, kendini sunucu diye **tanıtan** bir bilgisayarı (ör. yeni kurulmuş ikinci bir sunucu) yakalar. Şunları **yakalamaz**:

- **Canlı aktarma:** ağdaki bir bilgisayar keşfe kendi adresiyle yanıt verir, kimlik sorusunu gerçek sunucuya iletip yanıtı aynen döndürür, sonra kendi giriş sayfasını sunar. Cihazların arasına girmesi (ARP sahteciliği vb.) gerekmez. Hatırlanan adres yanıt vermediğinde (DHCP değişimi, sunucunun yeniden başlaması) `resolveServer` keşifte `known` dönen **ilk adayı** sorusuz seçer; sırayı yanıtların gelişi belirler.
- **Dinleme:** trafik şifrelenmez.

**Karar (R6, son inceleme):** `resolveServer` davranışı değiştirilmedi ve "birden fazla tanıdık aday varsa kullanıcıya sor" kuralı eklenmedi. İki ağ kartlı gerçek bir sunucu aynı parmak izini iki adresten verir ve aktarıcıdan ayırt edilemez; kural gerçek koruma getirmeden yanlış alarm üretirdi.

**Sonraki adım: kanal bağlama (Host imzası) ve şifreleme.** Sunucu imzaladığı metne kendisine hangi adresten sorulduğunu (`Host`) da katar, istemci bunu bağlandığı adresle karşılaştırır; böylece soruyu ileten aktarıcı yakalanır. Ardından trafik şifrelenir (§10). İlk açılış ekranının metni (`welcome.html`) bu yüzden değiştirilmedi: trafiğin açık taşındığını ve araya girilebileceğini zaten söylüyor.
