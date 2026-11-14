# Arayüz Ergonomisi (kısa tasarım)

Tarih: 2026-11-14
Durum: onay bekliyor
Öncesi: `2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md` (0.3.0)

## 1. Amaç ve neden

Ipchat'i okulda öğretmenler ve memurlar kullanacak; çoğu bilgisayarla arası iyi olmayan kişiler. Mevcut ekranlar çalışıyor ama "geliştirici arayüzü" seviyesinde: yanlış tıklamayla birinin hesabı reddedilebiliyor, grup sohbetinde kimin yazdığı görünmüyor, tepside en yıkıcı seçenek en sık kullanılanın dibinde duruyor. Kullanıcının açık isteği: **her yer ergonomik olsun.**

## 2. Hedefler

- Yıkıcı bir işlem kazara yapılamasın; yapılmadan önce tek cümlelik onay sorulsun.
- Grup sohbeti okunabilir olsun: kimin, ne zaman yazdığı görünsün.
- Kalabalık listelerde (kişiler, hesaplar) aranabilsin.
- Yazılar gözlüklü bir kullanıcı için okunur, düğmeler rahat tıklanır olsun.
- Tepsi menüsünde her seçeneğin adı yaptığı işi anlatsın.

## 3. Kapsam dışı

Görsel kimliğin baştan tasarlanması, yeni renk paleti/tipografi sistemi, karanlık mod, animasyon, emoji seçici, mesaj arama, sohbet geçmişinde arama, mobil/dokunmatik düzen.

## 4. Anti-hedefler

- Onay pencerelerinin her işleme yayılıp kullanımı yavaşlatması (yalnızca yıkıcı olanlar).
- Mevcut sade görünümün "kurumsal panel"e dönüşmesi; 800x620 sabit pencereye sığmayan düzen.
- Yenilemenin (3 sn) durması ya da okunmamış mantığının bozulması.

## 5. Kısıtlar

- Mevcut yığın: React + zustand + düz CSS. Yeni bağımlılık yok, yeni test kütüphanesi yok.
- 800x620 sabit pencere; B tasarımı ve mevcut renk değişkenleri korunur.
- Tüm metinler Türkçe.
- `POLL_MS = 3000` değişmez.

## 6. Yaklaşımlar

- **A. Noktasal düzeltmeler (seçildi).** Mevcut bileşenler yerinde kalır; sorunlu davranışlar tek tek düzeltilir. Risk düşük, her madde ayrı doğrulanabilir, 0.3.0'ın üstüne güvenle biner.
- **B. Ekranları baştan tasarlamak.** Daha tutarlı bir sonuç verirdi ama çalışan bir arayüzü bozma riski yüksek, kullanıcının elle test yükü büyür ve asıl hedef olan dosya paylaşımını geciktirir. Elendi.
- **C. Hazır bir bileşen kütüphanesi almak.** "Yeni bağımlılık yok" kısıtına aykırı ve 800x620 pencerede ağır kalır. Elendi.

## 7. Kararlar

### 7.1 Hesap onay ekranı (AdminPanel)

- **Bekleyen hesaplar öne çıkar:** kendi bölümünde, sayısı başlıkta (`Bekleyen hesaplar (3)`). Bekleyen yoksa bölüm tek satırlık bir bilgiyle kalır.
- **Düğme hiyerarşisi:** `Onayla` dolgulu birincil düğme; `Reddet` sönük ikincil. Aynı genişlikte iki eşit bağlantı olmaktan çıkar.
- **Onay penceresi yalnızca yıkıcı işlemlerde:** `Reddet`, `Kapat`, `Yöneticiliği al`. Metin kişinin adını içerir: *"Ahmet'in hesabı reddedilsin mi? Ahmet giriş yapamaz."* Varsayılan düğme **Vazgeç**. `Onayla`, `Aç`, `Yönetici yap` onaysızdır (yapıcı ve geri alınabilir). *(Benim kararım.)*
- **"Aktif" etiketi "Onaylı" olur.** Mevcut etiket hesabın onaylı olduğunu anlatıyor ama kullanıcı bunu "şu an bağlı" diye okuyor (kullanıcı bizzat bu karışıklığı bildirdi). Etiket kümesi: **Onaylı / Onay bekliyor / Reddedildi / Kapatıldı.**
- **Durum renkli etiket olur:** Onay bekliyor (sarı), Onaylı (yeşil), Reddedildi / Kapatıldı (gri). Küçük gri yazı yerine.
- **Çevrimiçi durumu ayrıca gösterilir.** `GET /api/admin/users` yanıtına `online` alanı eklenir (sunucu bunu `sockets/presence.js` içinde zaten tutuyor ve `/api/users` ucunda kullanıyor); satırda **Çevrimiçi / Çevrimdışı** olarak görünür. Böylece "onaylı mı" ile "şu an bağlı mı" iki ayrı bilgi olarak okunur. *(Kullanıcının isteği üzerine eklendi.)*
  - Sınır: çevrimiçi bilgisi sunucunun belleğindedir; sunucu yeniden başlarsa herkes bağlanana kadar çevrimdışı görünür. Bu kabul edilen davranıştır.
- **Yenileme fare liste üzerindeyken duraklar**, ayrılınca sürer. Tıklanmak üzere olan satırın altından kayması böylece engellenir. *(Benim kararım.)*
- **Arama kutusu:** tek satır, yazdıkça süzer, kullanıcı adında arar.
- **Hata mesajı işlemin yanında görünür** (ilgili satırın altında), yalnızca sayfanın tepesinde değil.

### 7.2 Sohbet penceresi

- Her mesajda **saat** (`14:32`), mesaj balonunun altında küçük ve sönük.
- **Grup sohbetinde gönderenin adı** balonun üstünde; kendi mesajlarında yazılmaz.
- **Gün değişiminde tarih ayracı** (`Bugün`, `Dün`, `12 Kasım`). *(Benim kararım.)*
- Kişi sohbetinde gönderen adı yazılmaz (zaten iki kişi var).

### 7.3 Kişi listesi

- **Arama kutusu** listenin üstünde; kişi ve grup adlarında süzer.
- Çevrimiçi/çevrimdışı ayrımı mevcut nokta ile kalır; sıralama değişmez. *(Sıralamayı değiştirmek okunmamış noktasının yerini oynatır, karışıklık yaratır — bilinçli olarak dokunulmuyor.)*

### 7.4 Tepsi menüsü (masaüstü)

- `Sunucuyu değiştir` → **`Başka bir sunucuya bağlan…`**, ve tıklayınca onay: *"Şu anki sunucuyla bağlantın kesilecek. Devam edilsin mi?"* (varsayılan Vazgeç). Bugün bu seçenek bir öğretmeni habersiz sohbetten düşürebiliyor.
- `Ipchat'i kaldır…` menünün **en altına**, `Çık`tan bir ayraçla ayrılmış ayrı bölüme taşınır.
- Menünün en üstüne, tıklanamayan bir **durum satırı**: `Bağlı: müdür-pc` ya da `Bağlı değil`. *(Benim kararım: kullanıcı "çalışıyor mu?" sorusunu menüyü açınca cevaplayabilsin.)*

### 7.5 Giriş ekranı

- Kutuların üstüne **kalıcı etiket** (`Kullanıcı adı`, `Şifre`); placeholder yalnızca biçim ipucu için.
- PIN ekranında **yinelenen gönder düğmesi kaldırılır**; tuş takımındaki `✓` kalır. *(Benim kararım: aynı işi yapan iki düğme kafa karıştırıyor.)*

### 7.6 Okunabilirlik (tüm ekranlar)

- Sönük yazı rengi `--muted` **`#8b93a7` → `#6b7280`** olur (beyaz üzerinde kontrast ~3:1'den ~4.6:1'e çıkar, standardı geçer).
- İşlem düğmelerinin tıklama alanı **en az 32px yükseklik**.
- Hata metinleri `0.85rem` → `0.9rem`.

## 8. Builder'a bırakılanlar

Onay penceresinin teknik biçimi (web'de kendi bileşenimiz, masaüstünde Electron `dialog` kullanılabilir — ikisinin de Türkçe metni yukarıda), tarih ayracının biçimlendirme kodu, arama süzmesinin uygulanışı, renkli etiketlerin CSS'i, duraklatmanın hangi olayla (`mouseenter`/`mouseleave`) bağlanacağı, test edilebilir parçaların nereye ayrılacağı.

## 9. Riskler

- Onay pencereleri masaüstünde Electron'dan, tarayıcıda kendi bileşenimizden gelirse metin ve davranış ayrışabilir; ikisinin de aynı Türkçe cümleyi kullanması gerekir.
- Saat/tarih biçimlendirmesi cihazın saat dilimine ve diline bağlıdır; Türkçe ve 24 saat biçimi sabitlenmeli.
- Arama kutuları 800x620 pencerede dikey alandan çalar; kişi listesinde yüksekliğin yetip yetmediği gerçek pencerede görülmeli.
