# Ipchat: Hesap Onayı, Electron Uygulaması ve Dosya Paylaşımı Tasarımı

Tarih: 2026-11-13
Durum: onay bekliyor

## 1. Amaç ve neden

Ipchat, yerel ağda (LAN/WiFi) çalışan, eski MSN Messenger tarzı bir mesajlaşma uygulaması. Faz 1 (merkezi Node.js sunucusu + React web arayüzü) tamamlandı.

Yeni ihtiyaç: Okuldaki idari bilgisayarlardan bazılarına, başında kimse yokken, uzaktan dosya alabilmek. Bugün dosya yalnızca iki kullanıcı karşılıklı mesajlaşırken gönderilebiliyor, yani karşı taraf ekran başında olmalı. İstenen şey ekran paylaşımı değil, yalnızca dosya erişimi.

Bunu yapabilmek için her PC'de arka planda çalışan bir ajan gerekiyor. Bu ajan, planlı Faz 2 masaüstü uygulamasının (Electron) içinde yaşayacak. Aynı çalışmada, ağdaki herkesin kendi kendine hesap açabildiği mevcut durumu yönetici onayına bağlıyoruz, çünkü dosya erişimi bu hesaplara güveniyor.

## 2. Hedefler

- Her kullanıcı, kendi PC'sini ağdaki diğer kullanıcılara dosya paylaşımına açabilsin ve bunu kendisi yönetsin.
- Başında kimse yokken de (PC açık, uygulama çalışıyor) dosya alınıp bırakılabilsin.
- Her dosya hareketi, hem işlemi yapan hem de dosyası etkilenen tarafta tarih, saat ve dosya adıyla kayıt altında olsun.
- Yeni hesaplar yönetici onayı olmadan sisteme girmesin.
- Tek kurulum: ajan, masaüstü uygulamasının parçası. Ayrı kurulum yok.
- Sunucu otomatik bulunsun (Faz 2'nin UDP keşfi).

## 3. Kapsam dışı

- Ekran paylaşımı ve uzak masaüstü.
- Kapalı bir bilgisayarı uyandırmak (Wake-on-LAN).
- Kullanıcı oturumu kapalıyken çalışan Windows servisi (Windows'ta oturum açık olmalı; ekran kilitli olabilir).
- İnternet üzerinden erişim. Sistem yalnızca yerel ağ için tasarlanıyor.
- Çevrimdışı PC'ye bekleyen istek kuyruğu: PC çevrimdışıysa istek başarısız olur.
- PC'den PC'ye doğrudan aktarım.

## 4. Anti-hedefler (teknik olarak çalışsa bile başarısızlık sayılır)

- Sistemin, ağa giren herhangi birinin bir bilgisayarın dosyalarına sessizce ulaşabildiği bir arka kapıya dönüşmesi.
- Kaydı tutulmayan veya sahibinin göremediği herhangi bir dosya erişimi.
- Sunucunun uzaktan bir PC'nin "tüm PC" modunu açabilmesi.

## 5. Kısıtlar

- Mevcut yığın: Node.js, Express, Socket.IO, node:sqlite, React/Vite, npm workspaces. Kod GitHub'da public (github.com/upburak/Ipchat).
- Uygulamada HTTPS yok, kimlik doğrulama basit. Bu yüzden yalnızca LAN'da çalıştırılır ve belgelerde açıkça yazılır.
- İlk hedef platform Windows. Electron kullanıldığı için Mac ve Linux sürümleri aynı kodla ileride gelecek (ayrı iş, bu belgenin kapsamında değil).
- Okuldaki idari PC'lerde öğrenci ve personel verisi olabilir (KVKK hassasiyeti). Varsayılanlar güvenli tarafta olmalı.

## 6. Yaklaşımlar (üç yol değerlendirildi, A seçildi)

- **A. Ajan Electron uygulamasının içinde, dosyalar sunucu üzerinden akar (seçildi).** Tek kurulum. Uygulama bilgisayar açılınca otomatik başlar, sistem tepsisinde bekler. Her dosya sunucudan geçtiği için kayıt güvenilir tutulur. Mac ve Linux aynı kodla gelir. Sınır: Windows'ta kullanıcı oturumu açık olmalı. Kullanıcı bunu kabul etti: bazı kullanıcılar bilgisayarı kapatıyor, bazıları kapatmıyor, sorun değil.
- **B. Ayrı Windows servisi + Electron arayüzü.** Oturum kapalıyken de çalışır, ama iki parça, ayrı kurulum, yüksek yetkili servis riski ve her işletim sistemi için ayrı iş demek. Elendi.
- **C. PC'den PC'ye doğrudan aktarım.** Her PC'de güvenlik duvarı ayarı gerekir, kurulum zorlaşır, kayıtlar sunucudan geçmediği için güvenilir tutulamaz. Elendi.

## 7. Kararlar (kullanıcının onayladığı haliyle)

### 7.1 Hesaplar ve yönetici onayı

- Yeni bir sunucuda **ilk açılan hesap otomatik yönetici** olur.
- Sonraki herkes kullanıcı adı ve şifreyle kayıt olur; hesap **"onay bekliyor"** durumuna düşer ve giriş yapamaz.
- Yönetici uygulamada "Bekleyen hesaplar" listesini görür, kişiyi **onaylar veya reddeder**. Onaylanan kişi önce şifresiyle giriş yapar, ardından mevcut akıştaki gibi o cihaz için 4 haneli PIN'ini belirler.
- Yönetici, bir kullanıcının hesabını **kapatabilir** (sistemden çıkarma).
- Giriş yöntemi aynı kalır: ilk seferde şifre, sonraki girişlerde cihaza bağlı 4 haneli PIN.

### 7.2 Electron uygulaması ve ajan

- Faz 2'nin Electron uygulaması, hem sohbet istemcisi hem dosya ajanıdır. Sistem tepsisinde yaşar, bilgisayar/oturum açılışında kendiliğinden başlar.
- Sunucuyu ağda otomatik bulur (UDP keşfi). Sohbet penceresi Messenger gibi sabit boyutlu, boyutlandırılamaz.
- Ajan sunucuya kalıcı bağlantıyla bağlı kalır ve gelen dosya isteklerine yanıt verir.

### 7.3 Paylaşım modları (her PC için, sahibi tarafından yönetilir)

1. **`ipchatPaylasim` klasörü** (her zaman açık): PC'nin kök dizininde, ajan kurulunca otomatik oluşur. Ağdaki tüm onaylı kullanıcılara açıktır ve kapatılamaz. İçinde herkes **dosyaları okuyabilir ve yeni dosya bırakabilir**; başkasının koyduğu dosyayı **silemez veya üzerine yazamaz**. Kullanıcılara ekranda "buraya hassas dosya koymayın" uyarısı gösterilir.
2. **Seçili klasörler:** PC'nin sahibi, paylaşmak istediği klasörleri kendisi seçer. Bu klasörler **salt okunurdur** (silinemez, değiştirilemez, yazılamaz).
3. **Tüm PC:** Seçilebilir bir mod; salt okunur. **Yalnızca o PC'nin kendi başında, uygulamanın içinden (veya kurulum sırasında) açılıp kapatılabilir**; sunucudan veya başka bir kullanıcıdan uzaktan açılamaz. Açarken onay penceresi çıkar, açıkken sistem tepsisi ikonu bunu açıkça gösterir.

Seçili klasörler ve "tüm PC" modu için, sahibi her biri için **kimlerin erişeceğini** seçer: "herkes" ya da "seçtiğim kişiler". **Varsayılan "seçtiğim kişiler"** (başlangıçta boş liste).

### 7.4 Dosya alma ve bırakma akışı

- Kullanıcı bir kişinin PC'sini seçer, paylaşıma açılmış ve kendisine izinli klasörleri görür, dosyayı indirir. Ya da `ipchatPaylasim` içine dosya bırakır.
- Aktarım **sunucu üzerinden** akar: istek sunucuya gider, sunucu ilgili PC'nin ajanına iletir, ajan dosyayı sunucuya, sunucu da isteyene aktarır.
- PC çevrimdışıysa veya ajan çalışmıyorsa istek, "PC şu an çevrimdışı" mesajıyla başarısız olur.

### 7.5 Kayıtlar (log)

- **Her dosya hareketi iki tarafta tutulur:** işlemi yapan kişi kendi yaptığı işlemleri, dosyası etkilenen PC'nin sahibi de kendi PC'sinde olanları görür.
- Her kayıtta: **tarih ve saat, işlemi yapan kullanıcı, hangi PC, dosya adı ve yolu, boyutu, işlem türü (alma / bırakma), sonuç** (başarılı / reddedildi / başarısız, nedeniyle).
- Reddedilen denemeler de kaydedilir (örn. izinli klasör dışına erişim girişimi).
- Kayıtlar kullanıcı arayüzünden **silinemez veya değiştirilemez**.

## 8. Kararlarım (kullanıcının açıkça söylemediği, benim verdiğim kararlar)

- Yönetici, **sunucudaki tüm kayıtları** görebilir (sunucu her aktarımı zaten gördüğü için). *Kullanıcı onayladı (2026-11-13). Kayıt ekranında kullanıcılara, kayıtların yönetici tarafından görülebildiği açıkça yazılır.*
- "Tüm PC" modunun uzaktan açılamaması ve tepsi göstergesi: *benim önerim, kullanıcı onayladı.*
- Mevcut Faz 1 hesaplarının geçişi: sunucu güncellenirken var olan hesaplar **"aktif"** sayılır; yönetici yoksa en eski hesap yönetici yapılır. *Benim çağrım.*
- Uygulama geliştirme sırası (önerilen): **M1** hesap onayı ve yönetici ekranı (mevcut web arayüzünde, hemen yapılabilir); **M2** Electron kabuğu + sunucu keşfi + otomatik başlatma; **M3** ajan, paylaşım modları, dosya akışı ve kayıtlar. *Benim çağrım; Windows testi ve bu sıra kullanıcıyla netleşecek.*
- `ipchatPaylasim` yolu: Windows'ta sistem sürücüsünün kökü (örn. `C:\ipchatPaylasim`). Mac/Linux için kullanıcının ana dizini kullanılır. *Benim çağrım, Mac/Linux sürümüne kadar kesinleşmesi gerekmiyor.* Standart bir Windows kullanıcısının `C:\` altında klasör oluşturabilmesi gerekir; bu Windows'ta doğrulanacak, olmazsa kullanıcı profili altında yedek bir konum kullanılır.
- **Kimlik doğrulama:** Mevcut oturum belirteci kullanılır (HTTP'de Bearer, Socket.IO el sıkışmasında `auth.token`). Ajan kullanıcının kendi oturumuyla bağlanır. Oturum doğrulaması yalnızca **aktif** hesapları kabul eder; hesap reddedilir veya kapatılırsa oturumları ve cihaz kayıtları silinir, açık bağlantıları kesilir. Dosya aktarım uçları her istekte kimlik denetler. *Benim çağrım.*
- **Yetki denetimi iki katmanlıdır:** Sunucu, "kim hangi PC'nin hangi klasörüne erişebilir" kararını verir (erişim listeleri sunucuda tutulur) ve reddedilen denemeleri kaydeder. Ajan ayrıca kendi yapılandırdığı klasörlerin dışına çıkmaz (yol normalleştirme, sembolik bağlantı kontrolü). Hangi klasörlerin paylaşıldığını PC'nin kendisi belirler ve sunucuya bildirir; "tüm PC" durumu sunucuda yalnızca bildirim olarak durur, ajan yerelde denetimi sürdürür. PC'nin sahibi kendi PC'sini kontrol eder. *Benim çağrım.*
- **Kayıt depolama:** Sunucudaki tek kayıt tablosu yetkilidir; isteyen ve dosyası alınan tarafın görünümleri aynı tablodan süzülür. Ajan ayrıca PC'de yalnızca ekleme yapılan yerel bir günlük dosyası tutar. *Benim çağrım.*
- **Dosya içeriği sunucuda saklanmaz,** sunucudan akıtılır. Bırakma işlemi için hedef ajanın canlı olması gerekir. Yarım kalan aktarım "başarısız" olarak kaydedilir. *Benim çağrım.*
- **`ipchatPaylasim` içinde dosya sahipliği takibi gerekmez:** Başkalarının silme veya üzerine yazma hakkı zaten yoktur, aynı isimli yeni dosya yeniden adlandırılır. PC'nin sahibi yerelde her şeyi yapabilir. *Benim çağrım.*
- **Hesap durumları:** aktif, onay bekliyor, reddedildi, kapatıldı. Reddedilen kişi yeniden kayıt olabilir, kapatılan hesap yönetici tarafından yeniden açılabilir. Birden fazla yönetici olabilir (yönetici başka birini yönetici yapabilir). Tek yönetici şifresini kaybederse, sunucu PC'sinde çalıştırılan bir kurtarma komutuyla şifre sıfırlanır. *Benim çağrım.*

## 9. Builder'a bırakılanlar

- Electron araçları ve paketleme seçimi, otomatik başlatma yöntemi.
- Aktarım protokolü ve akış (büyük dosyaları belleğe almadan aktarma), dosya boyutu sınırları.
- Veritabanı şeması (hesap durumu, paylaşım izinleri, kayıtlar) ve geçiş.
- Yol güvenliği ayrıntıları (yol atlatma, sembolik bağlantılar), "tüm PC" modunda hariç tutulacak sistem klasörleri.
- Ajan tarafı kayıtların saklanma biçimi ve saklama süresi.
- Arayüz ayrıntıları: kişi/PC listesi, dosya gezgini, paylaşım ayar ekranı, kayıt ekranı, bekleyen hesaplar ekranı.
- Aynı isimli dosya çakışmasının çözümü (örn. sonuna sayı ekleme).

## 10. Açık sınırlar ve bilinen riskler

- Sistem LAN içindir; HTTPS yok. Sunucu internete açılmamalıdır.
- Kayıt serbest olmadığı için hesap açmak artık yönetici onayına bağlı, ama yönetici hesabının ele geçirilmesi, onay verme yetkisini ele geçirmek demektir. Yönetici şifresi güçlü seçilmelidir.
- Oturumu kapatılmış veya kapalı PC'ler paylaşılamaz.
