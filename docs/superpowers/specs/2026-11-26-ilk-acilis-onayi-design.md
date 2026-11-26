# İlk Açılış Onayı (kısa tasarım)

Tarih: 2026-11-26
Durum: onaylandı (kullanıcı, 2026-11-26); 0.6.0 sürümünde birlikte çıkacak
İlgili: `2026-11-26-temiz-kaldirma-design.md` (0.5.0), `2026-11-26-sunucu-kimligi-design.md`

## 1. Amaç ve neden

Kullanıcının sözleriyle: uygulamanın *nerede ve nasıl kullanıldığından doğan olası riskleri çalışma yapısı gereği taşıdığını, bunun programdaki bir hatadan kaynaklanmadığını* belirten bir açıklama, **kurulumdan sonra** gelsin; **onay verilince** program çalışsın.

Ipchat yerel ağ için tasarlandı: veri ağda açık taşınır, kimlik doğrulama basittir, mesajlar sunucu bilgisayarında durur. Bunlar kusur değil, mimarinin bilinen sonuçlarıdır; ama kullanıcılar bunu bilmezse hassas bilgiyi buradan gönderebilir. Bilgiyi uygulamayı kullanmadan **önce** göstermek, sorumluluğun nerede olduğunu da açık eder.

## 2. Hedefler

- Her kullanıcı uygulamayı ilk kullanmadan önce sınırları okur ve onaylar.
- Onay verilmeden **hiçbir şey çalışmaz**: ağ keşfi yok, sunucu başlatma yok, otomatik başlatma kaydı yok, tepsi yok.
- Kaldırma kuralı (0.5.0) aynı ekranda, **ayrı bir onayla** gösterilir. Mac'teki ayrı ilk açılış bildirimi bu ekranla birleşir.
- Onay bir kez sorulur; güncellemede ve sonraki açılışlarda sorulmaz.

## 3. Kapsam dışı

Tarayıcıdan girenler (bu ekran yalnızca masaüstü uygulamasındadır); şifreleme ya da güvenlik iyileştirmesi (bu belge yalnızca **bilgi verir**); çok dilli metin; onayın geri alınması ya da ayarlardan yeniden gösterilmesi; yöneticinin sunucudan herkese zorla onay göstermesi.

## 4. Anti-hedefler

- Onay ekranının hukuki/korkutucu bir duvara dönmesi: metin sade ve kısa kalır.
- "Hepsini işaretle" kolaylığıyla okunmadan geçilmesini teşvik etmek: iki onay ayrı işaretlenir.
- Reddetmenin kalıcı bir şey yapması: **Çık** yalnızca uygulamayı kapatır, hiçbir şey kaydedilmez, bir sonraki açılışta ekran yeniden çıkar.

## 5. Kısıtlar

- Yeni bağımlılık yok. Metin Türkçe. Pencere 800x620 sabit; metin sığmazsa kaydırılır.
- Bu ekran Electron'a bağlıdır, **otomatik testle kapsanmaz**; yalnızca karar mantığı (gösterilsin mi, hangi sürüm onaylandı) test edilir. Gerçek denemeyi kullanıcı yapar.
- Windows'ta kurulum sihirbazı yoktur (tek tık NSIS); "kurulum sonrası" ilk açılış demektir.

## 6. Yaklaşımlar

- **A. Pencere içinde yerel bir sayfa (seçildi).** `connect.html` ile aynı kalıp: uygulamanın kendi penceresinde, uygulamaya ait bir sayfa. Uzun metin ve iki onay kutusu rahat sığar; Mac'te "gizli pencerede diyalog görünmez" tuzağına (0.3.0) düşmez, çünkü pencere zaten açık ve görünür.
- **B. İşletim sistemi mesaj kutusu.** İki ayrı onay kutusu ve bu uzunlukta metin sığmaz; Mac'te pencere gizliyken görünmeme riski var. Elendi.
- **C. Windows kurulumunun içine yerleştirmek.** Tek tık kurulumda sayfa yok, sayfa eklemek ek tıklama demek, Mac'e de uygulanamaz. Elendi.

## 7. Kararlar

### 7.1 Ekran ve metin

Kullanıcı metni onayladı ("metin çok iyi olmuş"). Başlık: **"Ipchat'i kullanmaya başlamadan önce"**.

> Ipchat yalnızca okulun kendi yerel ağında çalışır. Mesajlar ve dosyalar internete çıkmaz, bir buluta ya da başka bir şirkete gitmez; yalnızca sunucu olarak seçilen bilgisayarda durur.
>
> Bu yapı sade olduğu için bazı sınırları var. Bunlar bir arıza değil, uygulamanın böyle kurulmuş olmasının sonucu:
>
> - Veri aynı ağ içinde açık taşınır. Ağa girebilen ve araya girmeyi bilen biri mesajları okuyabilir. Ipchat banka uygulamaları gibi şifreli bir hat kurmaz.
> - Mesajlar ve hesaplar sunucu bilgisayarında durur. O bilgisayara erişen kişi veriye de erişir. O bilgisayarı korumak ve yedeğini almak okulun sorumluluğundadır.
> - Sunucu internete açılmamalıdır. Modemde yönlendirme yapılırsa uygulama dışarıdan erişilebilir hale gelir.
> - Kimlik doğrulama basittir: kullanıcı adı, şifre ve cihaza bağlı PIN. Şifreler paylaşılmamalıdır.
>
> Bu nedenle öğrenci kişisel verileri, sağlık ve kimlik bilgileri, sınav soruları, maaş ve banka bilgileri gibi hassas içerikleri Ipchat üzerinden göndermeyin. Uygulama günlük yazışma ve sıradan iş dosyaları için tasarlandı.

Ardından **kaldırma kuralı** (metin platforma göre değişir, bkz. 7.4.1). Örnek, Windows:

> Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz: program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir. Bu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur.

Mac'te aynı kural "program, ayarlar ve otomatik başlatma kaydı silinir" diye yazılır ve ardından kaldırmanın tepsi menüsünden "Ipchat'i tamamen kaldır…" ile yapıldığı, uygulamayı yalnızca Çöp Kutusu'na atmanın veriyi geride bıraktığı söylenir.

### 7.2 İki ayrı onay

Sayfanın altında **iki onay kutusu**, ikisi de başta işaretsiz:

1. ☐ **Yukarıdaki sınırları okudum, anladım.**
2. ☐ **Kaldırma kuralını okudum, anladım.**

**"Devam et"** düğmesi ikisi de işaretlenene kadar pasiftir. Yanında **"Çık"** düğmesi bulunur.

### 7.3 Onayın kaydı ve sürümü

Onay, ayar dosyasına `welcomeAccepted: { version: 1, at: <tarih> }` olarak yazılır. Metin **içerik olarak** değişirse `version` artırılır ve herkes yeniden onaylar; yazım düzeltmesi için artırılmaz. Windows'ta ayar kullanıcı başınadır, yani aynı bilgisayarı iki kişi kendi hesabıyla kullanıyorsa ikisi de bir kez görür.

Eski `installNoticeShown` bayrağı yerini bu yeni bayrağa bırakır: **0.5.0'da Mac'teki bildirimi görmüş kullanıcı da bu ekranı bir kez görür**, çünkü yeni ekran farklı ve daha geniş bir metin içerir. Mac'teki eski mesaj kutusu kaldırılır. *(Benim kararım.)*

### 7.4 Onay öncesinde ne çalışmaz (kapı)

Onay yokken ana süreç şunları **yapmaz**: sunucu keşfi (UDP yayını), uzak ya da yerel sunucuya bağlanma, kayıtlı sunucu modunu başlatma, otomatik başlatma kaydı (`setLoginItemSettings`), tepsi ikonu ve menüsü, bildirim izni isteme. Yalnızca bu sayfa görünür. Pencerenin kapatma düğmesi bu durumda tepsiye indirmez, **uygulamayı kapatır** (tepsi yok, arkada sessizce bekleyen onaysız bir süreç kalmaz). Onaydan sonra normal akış, bugünkü sırayla başlar.

Geliştirme modunda (`app.isPackaged` yalnızca paketli sürümü işaretler) ekran gösterilmez; geliştiricinin her denemede onaylamasına gerek yok. *(Mac'teki eski bildirimin de aynı davranışı vardı.)*

### 7.4.1 Üç netleştirme (inceleme sonrası, benim kararlarım)

- **Onay kaydedilemezse** (ayar dosyası salt okunur, disk dolu): uygulama **bu oturum için çalışmaya devam eder**, bir sonraki açılışta ekran yeniden çıkar. Engellemek, sunucu bilgisayarını sonsuza kadar kapalı bırakırdı; ekranın tekrar çıkması ise yalnızca can sıkıcıdır, güvenliği düşürmez. Sayfa ayrıca bir hata satırı göstermez; kaydetme hatası sessizce yutulur (0.5.0'daki eski bildirimle aynı yaklaşım).
- **Mevcut otomatik başlatma kaydı** (bu sürümden önce kurulmuş bilgisayarlar): "Çık" bu kaydı **silmez**. Kapı yalnızca **yeni** kaydı onaya bağlar (7.4). Yani onay vermemiş bir kullanıcı her oturum açışında ekranı yeniden görür; bu, "onay verilince program çalışsın" kuralının doğal sonucudur. Gizli bir silme eklenmez.
- **Kaldırma kuralının metni platforma göre değişir, kaynağı tek dosyadır** (`cleanup.js`): Windows'ta *"program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir"*; Mac'te *"program, ayarlar ve otomatik başlatma kaydı silinir"* ve ardından tepsi menüsü ile Çöp Kutusu cümlesi. Sunucu cümlesi ikisinde de aynıdır. Eski Mac `INSTALL_NOTICE` sabiti bu ortak yapıya taşınır. `installer.nsh` metnine dokunulmaz.

### 7.5 Windows kurulum sonu mesajı

Windows kurulumunun sonunda gösterilen kaldırma kuralı kutusu (`installer.nsh`) **olduğu gibi kalır**. Kaldırma kuralı bu yüzden Windows'ta iki kez görünür (kurulum sonunda ve ilk açılışta). *(Benim kararım: gerçek Windows'ta çalıştığı doğrulanmış NSIS betiğine, kazanç küçükken dokunmamak. Kullanıcı tekrarı istemezse ayrı küçük bir işle kaldırılır.)*

## 8. Builder'a bırakılanlar

Sayfanın görünümü (`connect.html` stiliyle uyumlu, düğmeler ≥32px), onay kutuları ile düğme arasındaki erişilebilirlik ayrıntıları (klavyeyle gezinme, kutuya tıklanabilir etiket), kapı mantığının `main.js` içinde nereye konacağı, saf mantığın (`shouldShowWelcome(config)`, sürüm karşılaştırması) ayrı dosyaya çıkarılması ve test edilmesi.

## 9. Riskler

- **Sunucu bilgisayarında güncelleme günü.** Mevcut bir sunucu bilgisayarı yeni sürüme geçtiğinde, bu ekran onaylanana kadar **sunucu çalışmaz** (kapı sunucu modunu da durdurur). Müdürün bilgisayarı oturum açıldığında uygulama kendiliğinden açılır ama onay beklerken kimse bağlanamaz. Yayın notuna yazılır: **güncellemeden sonra önce sunucu bilgisayarında bir kez "Devam et"e basılmalıdır.**
- Kapı yanlış yazılırsa ya ekran hiç çıkmaz ya da onaylanmış kullanıcı sonsuza kadar onay ekranında kalır. İkisi de bu belgenin mantık testleriyle ve kullanıcının gerçek denemesiyle yakalanmalıdır.
- Metin uzun; 800x620'de kaydırma gerekebilir. Onay kutuları kaydırma alanının **dışında**, altta sabit durmalı ki kaybolmasın.
- Mac'te bu ekran gerçek bir Mac'te hiç denenmedi (okulda Mac yok); 0.3.0'da pencereyle ilgili macOS'a özgü bir tuzak çıkmıştı.
