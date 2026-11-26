# Temiz Kaldırma (kısa tasarım)

Tarih: 2026-11-26
Durum: onaylandı (kullanıcı 2026-11-26)
İlgili: `2026-11-14-arayuz-ergonomisi-design.md` (0.4.0)

## 1. Amaç ve neden

Kullanıcının isteği, kendi sözleriyle: *"uygulamayı kaldırmak isterse derin silme ile kurulduğu dizindeki her şey silinsin… arkasında dosya anahtar kayıt vs regedit kaydı falan bırakmasın."* Okul bilgisayarlarında program gelip gider; geride ayar dosyası, kayıt defteri girdisi ve güvenlik duvarı kuralı bırakan bir uygulama, bir süre sonra kimsenin açıklayamadığı artıklar demektir.

Tek istisnayı kullanıcı sonradan kendisi ekledi: *"sunucuda komple silme olmasın, sadece istemcilerde tam silme olsun."* Sunucu olan bilgisayarda okulun bütün hesapları ve yazışması durur; bu, bir kaldırma işlemiyle yok olmamalı.

Bugünkü davranış ikisinin arasında: kaldırıcı "Sohbet geçmişi ve ayarlar da silinsin mi?" diye **soruyor** ve varsayılan **Evet**. Yani istemcide iz kalabiliyor (Hayır denirse), sunucuda ise refleksle Evet'e basılırsa her şey gidebiliyor. Tam tersi olmalı.

## 2. Hedefler

- İstemci bilgisayarda kaldırma, **soru sormadan** hiçbir iz bırakmaz.
- Sunucu bilgisayarında hesaplar ve mesaj geçmişi **korunur**, nerede durdukları kullanıcıya söylenir.
- Kullanıcı bu davranışı **kaldırmadan önce** bilir: hem kurulumda hem kaldırmada yazar.
- Windows ve Mac aynı kuralı uygular.

## 3. Kapsam dışı

Sunucu verisinin yedeklenmesi veya dışa aktarılması; verinin başka bir bilgisayara taşınması; Node.js'in ya da `kurulum.bat` ile kurulmuş eski sürümün kaldırılması; uygulama içinden "verimi sil" düğmesi.

## 4. Anti-hedefler

- Sunucu bilgisayarında okulun geçmişinin sorulmadan silinmesi.
- Kullanıcının, kaldırdıktan **sonra** ne silindiğini öğrenmesi.
- Kaldırma akışına ek tıklama veya karar eklenmesi (kullanıcının açık isteği: en az iş).
- Güncelleme sırasında veri veya ayar kaybı.

## 5. Kısıtlar

- Windows kurulumu `oneClick: true` NSIS'tir: sihirbaz sayfası yoktur, metin ancak bir mesaj kutusuyla gösterilebilir. (Sayfalı kuruluma geçmek fazladan tıklama demekti; yapılmadı.)
- Mac'te **kurulum adımı yoktur** (zip'ten sürükle-bırak), dolayısıyla "kurulumda metin" Mac'te kurulum sırasında gösterilemez.
- Mevcut yığın ve kurallar korunur: yeni bağımlılık yok, metinler Türkçe.
- Kaldırıcı Electron'suz çalışır (NSIS betiği), bu yüzden mantığı orada da ifade edilebilir olmalı.

## 6. Yaklaşımlar

- **A. Sunucu verisini yerinde koruyup geri kalan her şeyi silmek (seçildi).** Kaldırıcı `server-data` klasörünün varlığına bakar — bu zaten bugün de yapılan tespit. Varsa o klasör hariç her şey silinir; yoksa klasörün tamamı silinir. Soru sorulmaz.
- **B. Sunucuda sormak, istemcide sormamak.** Kullanıcının ilk istediği buydu, sonra vazgeçti: soru sorulan an refleksle "Evet"e basılan andır, ve bu seferki "Evet" geri alınamaz. Elendi.
- **C. Her yerde sormadan her şeyi silmek.** En temiz kural ama sunucuda okulun geçmişini tek tıkla yok eder. Kullanıcı bunu açıkça reddetti. Elendi.

## 7. Kararlar

### 7.1 Neyin silineceği (her iki bilgisayarda)

- Program dosyaları, Başlat menüsü ve masaüstü kısayolları (kurulumun kendi işi).
- Otomatik başlatma kayıt defteri girdileri (bugün silinenlerin tamamı korunur).
- Güvenlik duvarı kuralları (TCP 3000, UDP 41234).
- `%APPDATA%\ipchat-desktop` içindeki **`server-data` dışındaki her şey**: `config.json`, hatırlanan sunucu adresi, cihaz/PIN kaydı, günlükler, Electron'un bıraktığı önbellekler.

### 7.2 Neyin korunacağı

- `%APPDATA%\ipchat-desktop\server-data` — yalnızca varsa, yani bu bilgisayar sunucu olarak kullanıldıysa.
- İleride gelecek paylaşım klasörleri (`ipchatPaylasim`): kullanıcı bunların kalmasını istedi. Henüz yoklar; dosya paylaşımı eklendiğinde bu listeye girerler. *(Şimdi yapılacak bir şey yok, not olarak duruyor.)*

### 7.3 İstemci / sunucu ayrımı

`server-data` klasörünün varlığı belirler. Varsa sunucu, yoksa istemci. Bu tespit bugün de kullanılıyor ve sunucu modu bir kez bile açılmışsa klasör oluşmuş olur.

### 7.4 Soru sorulmaz

Bugünkü "Sohbet geçmişi ve ayarlar da silinsin mi?" sorusu **kaldırılır**. Kaldırma bir karar sormaz, ne yaptığını söyler.

### 7.5 Metinler

**Kurulum sonunda (Windows, sessiz olmayan kurulum, bir kez):**

> Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz: program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir.
>
> Bu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur.

**Kaldırma sırasında, istemci bilgisayarda:**

> Ipchat ve bu bilgisayardaki tüm verisi siliniyor. Bu işlem geri alınamaz.

**Kaldırma sırasında, sunucu bilgisayarda:**

> Bu bilgisayar Ipchat sunucusuydu.
>
> Kullanıcıların hesapları ve mesaj geçmişi **silinmedi**, şurada duruyor:
> %APPDATA%\ipchat-desktop\server-data
>
> Bunları da silmek istersen bu klasörü elle sil.

**Mac, tepsideki "Ipchat'i tamamen kaldır…" onayında:** aynı kural anlatılır, "Sohbet geçmişi ve ayarlar da silinsin" onay kutusu kaldırılır. Onay penceresinin kendisi kalır (yıkıcı işlem), varsayılanı **Vazgeç** olur. Sunucu verisi varsa metin onun korunacağını ve yolunu (`~/Library/Application Support/ipchat-desktop/server-data`) söyler.

### 7.6 Güncelleme ve sessiz kaldırma

- **Güncelleme (`isUpdated`):** bugünkü gibi hiçbir şeye dokunulmaz — ne veri, ne ayar, ne kayıt defteri.
- **Sessiz kaldırma (`Silent`):** silme kuralı aynen uygulanır (kural "iz kalmaz"), yalnızca mesaj gösterilmez. *(Benim kararım: bugün sessiz kaldırma veriyi hiç silmiyor; bu, kuralın istisnası olurdu.)*

### 7.7 Mac'te kurulum metni

Mac'te kurulum adımı olmadığı için metin **uygulamanın ilk açılışında bir kez** gösterilir. *(Benim kararım: kullanıcı metnin "hem kurulumda" görünmesini istedi; Mac'te buna en yakın an ilk açılıştır. Alternatif, metni yalnızca kaldırma anında göstermekti — geç kalırdı.)*

## 8. Builder'a bırakılanlar

NSIS'te `server-data` hariç silmenin nasıl yazılacağı (klasörü geçici bir yere taşıyıp geri koymak ya da tek tek silmek), mesaj kutularının tipi ve sırası, Mac ilk açılış bildiriminin nerede saklanacağı (ayar dosyasında bir bayrak), test edilebilir parçaların ayrılması.

## 9. Riskler

- NSIS betiği yalnızca CI'da derlenip gerçek Windows'ta elle denenebiliyor; `server-data` hariç silme mantığı orada doğrulanmalı. Yanlış yazılırsa ya veri silinir ya da artık kalır — ikisi de sessizce olur.
- "Sunucu mu?" tespiti klasörün varlığına dayanır. Sunucu modu açılıp hemen kapatılmış bir istemcide klasör kalmış olabilir; o bilgisayarda birkaç KB veri korunur. Zararsız tarafta hata.
- Kaldırma sırasında uygulama çalışıyorsa dosya kilitli olabilir; mevcut `taskkill` adımı korunmalı ve silmeden önce çalışmalı.
