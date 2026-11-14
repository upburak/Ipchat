# Okunmamış Mesaj Noktası, Anlık Mesaj Bildirimi ve İkinci Sunucu Koruması (kısa tasarım)

Tarih: 2026-11-14
Durum: onaylandı ve uygulandı (0.3.0)
Önceki belgeler: `2026-11-13-bildirim-yenileme-kurulum-tasarim-design.md` (3 sn yenileme, rozet, B tasarımı)

## 1. Amaç ve neden

Windows+Mac testi çalıştıktan sonra kullanıcı üç şey istedi:
1. Ağda zaten bir sunucu varsa, yanlışlıkla ikinci bir sunucu kurulmasın.
2. Başka bir kullanıcıdan mesaj gelince **kimden geldiği** anlık gösterilsin ve kişi listesinde o kişinin üzerinde yeni mesajı belirten bir **nokta** olsun. Uygulama kapalıyken gelen mesajlar da açılışta görünsün (kullanıcı **A** seçeneğini seçti: sunucu okunmamışları tutar).
3. Emoji vb. şu an yok (bilgi notu; bu belgenin kapsamı dışı).

## 2. Hedefler

- Okunmamış mesaj durumu **sunucuda** tutulur; hiçbir mesaj kaçmaz (uygulama kapalıyken gelenler dahil).
- Kişi (ve grup) satırında, okunmamış mesaj varsa **nokta** ve kalın ad görünür; sohbeti açıp okuyunca kaybolur.
- Başka kullanıcıdan mesaj gelince, o sohbet açık ve pencere odakta **değilse**, işletim sistemi bildirimi gelir. Başlıkta gönderen adı, gövdede "Yeni mesaj" yazar.
- Bildirime tıklayınca pencere öne gelir ve o sohbet açılır.
- Ağda başka bir sunucu varken "Bu bilgisayarı sunucu yap" seçeneği tepside ve bağlantı ekranında sunulmaz; sunucu modunu açmak her zaman bir onay penceresiyle yapılır.

## 3. Kapsam dışı

Emoji seçici, yazıyor göstergesi, "okundu" tikleri (gönderene gösterilen), sohbet başına sessize alma, bildirim sesi ayarı, mesaj içeriğinin bildirimde gösterilmesi, tarayıcı (masaüstü uygulaması olmayan) istemcide işletim sistemi bildirimi.

## 4. Anti-hedefler

- Yeni kurulumda veya güncellemede **tüm eski mesajların** okunmamış görünmesi.
- Kullanıcının kendi mesajlarının kendisi için okunmamış sayılması.
- Açık ve odaktaki sohbette gelen mesaj için bildirim spam'ı.
- Bildirimin mesaj içeriğini ekranda göstermesi (başkası ekrana bakarsa okumasın).

## 5. Kısıtlar

- Mevcut yığın ve kurallar korunur: 3 sn yenileme (`POLL_MS = 3000`), 800x620 sabit pencere, B tasarımı, Türkçe metinler, yeni bağımlılık yok.
- Mesajlar Socket.IO `message:new` olayı ile zaten anlık gelir; okunmamış sayıları 3 sn'lik yenilemeyle de düzeltilir (kaçan olay kalıcı bayatlık yaratmasın).
- Masaüstü köprüsü yalnızca bağlı sunucunun kaynağından gelen sayfaya açık kalır (önceki belgedeki kural).

## 6. Yaklaşımlar

**Okunmamış takibi**
- **Sohbet başına "son okunan mesaj kimliği" (seçildi).** Sunucuda `read_state(user_id, kind, peer_id, last_read_id)` tablosu. Okunmamış sayısı = o sohbetteki, benim göndermediğim ve `last_read_id`'den büyük mesajlar. Basit, grup ve kişi sohbetini aynı mantıkla çözer.
- Her mesajda "okundu" bayrağı: grup mesajlarında her üye için ayrı tutulması gerektiğinden karmaşık. Elendi.

**İkinci sunucu koruması:** Mevcut keşif sonucunu (`resolveServer`) kullanmak tek mantıklı yol; ayrı bir sinyal mekanizması gerekmez.

## 7. Kararlar

### 7.1 Sunucu
- Yeni tablo `read_state(user_id, kind TEXT CHECK (kind IN ('user','group')), peer_id INTEGER, last_read_id INTEGER, PRIMARY KEY (user_id, kind, peer_id))`.
- Geçiş: kurulumda `meta` tablosuna `unread_baseline_id` = o anki en büyük mesaj kimliği yazılır; okunmamış sayımı `max(baseline, last_read_id)`'den büyük mesajları sayar. Böylece eski mesajlar okunmuş sayılır.
- `GET /api/unread` → `{ "user:<id>": <sayı>, "group:<id>": <sayı> }` (yalnızca sayısı > 0 olanlar). Kişi sohbeti için: gönderen o kişi, alıcı ben; grup için: grup mesajı, ben üyeyim, gönderen ben değil.
- `POST /api/read` `{ type, id }` → o sohbeti şu anki en son mesaja kadar okunmuş işaretler. Üyesi olunmayan grup için 403; olmayan/etkin olmayan kişi için 404.

### 7.2 Web arayüzü
- Mevcut 3 sn yenilemeye `GET /api/unread` eklenir; sayılar durumda tutulur. `message:new` olayı gelince, sohbet açık ve pencere odakta değilse o sohbetin sayısı hemen artırılır.
- Kişi/grup satırında sayı > 0 ise **kırmızı nokta** (sayı yazmaz) ve kalın ad.
- Sohbet açılınca ve açıkken yeni mesaj gelirse (pencere odakta) `POST /api/read` çağrılır; nokta kaybolur.
- Masaüstü köprüsünün `notify` işlevi `{ title, body, open?: { type, id } }` alır. Tıklayınca ana süreç sayfaya `ipchat:open-conversation` gönderir, sayfa o sohbeti açar.
- Bildirim koşulu: mesaj başkasından, ve (pencere odakta değil **veya** o sohbet açık değil). Aynı kişiden art arda gelen mesajlar tek bildirime birleştirilir (en son bildirimden sonra 5 sn içinde gelenler yeni bildirim üretmez).
- Sayfa başlığı okunmamış toplamını gösterir: `(3) Ipchat`.

### 7.3 Masaüstü: tepsi ve rozet
- Tepsi ikonu, bekleyen hesap sayısı **veya** okunmamış mesaj sayısı > 0 ise uyarı rengine geçer; ipucu ikisini ayrı satırlarda yazar. Mac Dock rozeti ikisinin toplamıdır. (Benim çağrım.)
- Köprüye `setUnread(count)` eklenir; `setBadge` bekleyen hesap sayısı olarak kalır.

### 7.4 İkinci sunucu koruması
- Ana süreç, son keşif sonucunda başka bir sunucunun bulunup bulunmadığını ve şu an uzak bir sunucuya bağlı olup olmadığını tutar (`networkServerKnown`).
- `networkServerKnown` doğruysa tepsi menüsünde **"Bu bilgisayarı sunucu yap" gösterilmez** (yerine devre dışı bir satır: "Ağda zaten bir sunucu var"); bağlantı ekranında "Bu bilgisayar sunucu olsun" düğmesi devre dışı olur ve açıklama gösterir.
- Sunucu modunu açmak (tepsiden veya bağlantı ekranından) **her zaman** bir onay penceresiyle yapılır: "Bu bilgisayar sunucu olacak. Ağda başka bir sunucu varsa karışıklık olur. Devam edilsin mi?" (varsayılan: Vazgeç). Bu, keşif engelliyken bile korur.
- Sunucu olan bilgisayarda mevcut "Sunucu modunu kapat" aynen kalır.

## 8. Benim verdiğim kararlar (kullanıcıdan açıkça onay alınmadı)

- Bildirimde mesaj içeriği gösterilmez ("Yeni mesaj" yazar).
- Nokta kırmızıdır ve sayı yazmaz.
- Grup mesajları da okunmamış sayılır.
- Okunmamış mesaj tepsi ikonunu ve Dock rozetini de etkiler.
- Art arda gelen mesajlar 5 sn içinde tek bildirime birleşir.
- Sunucu modu açılırken her zaman onay sorulur.
- Eski mesajlar kurulumda okunmuş sayılır (baseline).

## 9. Builder'a bırakılanlar

Sayım sorgusunun verimliliği (ör. dizin), `read_state` güncellemesi (upsert), bildirim birleştirme zamanlayıcısı, noktanın CSS'i, bağlantı ekranındaki devre dışı metin, testlerin ayrıntısı.

## 10. Riskler

- Odak/pencere durumu masaüstünde Electron'dan, tarayıcıda `document.hasFocus()` ile alınır; ikisi tutarsız olabilir. Yanlış negatif (bildirim gelmemesi) yerine yanlış pozitif (fazladan bildirim) tercih edilir.
- Keşif engelliyse (UDP kapalı) ağdaki sunucu görünmez ve koruma yalnızca onay penceresine dayanır.
