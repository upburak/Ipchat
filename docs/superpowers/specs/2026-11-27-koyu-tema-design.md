# Koyu Tema (kısa tasarım)

Tarih: 2026-11-27
Durum: onaylandı (kullanıcı, 2026-11-27); uygulama planı: docs/superpowers/plans/2026-11-27-koyu-tema.md
İlgili: `2026-11-14-arayuz-ergonomisi-design.md` (0.4.0'da "renk paleti/karanlık mod" kapsam dışıydı; şimdi kullanıcı istedi)

## 1. Amaç ve neden

Kullanıcının sözleriyle: *"futuristik ama gözü rahatsız etmeyen bir tema"*; referans olarak kendi sitesinin (BTY Portal) ekran görüntüsünü verdi: çok koyu laciverte yakın zemin, biraz açık ince kenarlıklı yuvarlak kartlar, tek vurgu rengi olarak camgöbeği, yazılar açık renk.

Ipchat bugün açık renkli (zemin `#f3f4f8`, mor-indigo vurgu `#6366f1`). Hedef: aynı düzen ve aynı özellikler, yeni bir koyu görünüm. Kullanıcının kararı: **şimdilik yalnızca koyu**; ileride uygulamaya bir **tema menüsü** eklenip temalar arasında geçiş yapılabilecek.

## 2. Hedefler

- Web arayüzünün tamamı (giriş, PIN, kişi listesi, sohbet, hesap ekranı, onay ve grup pencereleri) koyu temada.
- Masaüstünün kendi iki sayfası (`connect.html`, `welcome.html`) aynı temada, böylece uygulama açılırken beyaz bir ekran parlamaz.
- Göz rahatı: saf beyaz/siyah yok, parlama (glow) yok, tek vurgu rengi, yumuşak yüzeyler.
- Okunabilirlik: her yazı/zemin çifti **WCAG 4.5:1** üstünde (projenin standardı), ölçülerek doğrulanır.
- **Renkler tek yerde**: ileride ikinci bir tema eklemek yeni bir blok yazmak kadar küçük bir iş olmalı.

## 3. Kapsam dışı

Tema menüsü ve seçimin saklanması (sonraki iş); açık tema; düzen, yazı tipi, boyut değişikliği (yalnızca renk ve yüzey); yeni animasyon; uygulama/tepsi ikonu; Windows başlık çubuğunun rengi (denenecek ama garanti verilmez, bkz. §9).

## 4. Anti-hedefler

- Neon parlama, cam bulanıklığı (`backdrop-filter`), gökkuşağı/çok renkli degrade, gösterişli gölgeler. (Kullanıcının "gözü rahatsız etmeyen" şartı; `anti-slop` ve `colour-palette` kuralları.)
- Kontrastın düşmesi: koyu temada sönük yazı kolayca okunmaz hâle gelir.
- Düzenin ya da davranışın değişmesi: bu iş yalnızca görünüm.
- Aynı paletin birkaç yerde elle tekrarlanıp zamanla birbirinden kayması.

## 5. Kısıtlar

- Yeni bağımlılık yok; mevcut düz CSS ve mevcut sınıf adları korunur. Testler `node:test`.
- Sabit pencere 800x620; mevcut yazı tipi (sistem yazı tipi) korunur.
- Masaüstü sayfaları (`connect.html`, `welcome.html`) web paketinden ayrı dosyalardır; web arayüzü sunucudan servis edilir.

## 6. Yaklaşımlar

- **A. Mevcut `:root` değerlerini koyuya çevirmek.** En az iş, ama ileride ikinci tema gelince belirteçleri yeniden yapılandırmak gerekir. Elendi.
- **B. Renkleri belirteç olarak tek bloğa toplayıp temayı bir nitelikle seçmek (seçildi).** `<html data-theme="koyu">`; belirteçler `:root[data-theme="koyu"]` altında; koyu varsayılan. İleride yeni tema = yeni blok + menü. Bugünkü işten biraz fazlası: `style.css` içinde belirteç dışında kalan 24 sabit rengin belirtece çevrilmesi gerekir. *(Benim kararım, kullanıcının "sonra menü ekleriz" isteğinden çıkardım.)*
- **C. Hazır bir tema/UI kütüphanesi.** "Yeni bağımlılık yok" kısıtına aykırı. Elendi.

## 7. Kararlar

### 7.1 Palet (ölçülmüş kontrastlarla)

Aşağıdaki değerler `colour-palette` kuralına göre seçildi (60% zemin, 30% yüzey, yaklaşık 10% vurgu) ve kontrastları hesaplanıp denendi. Gerçek uygulamada son değerler ölçümle kesinleşir (§8).

| Rol | Değer | Not |
|---|---|---|
| Zemin (L0) | `#0A1018` | ana arka plan |
| Yüzey (L1) | `#101A25` | kartlar, kenar çubuğu, sohbet balonları |
| Yükseltilmiş (L2) | `#16222F` | pencereler (modal), açılır katmanlar |
| Kenarlık | `#1B2A3A` | 1px ince; yükseltilmiş her yüzeyde önce kenarlık |
| Yazı | `#E6EEF5` | zeminde **16.3:1**, yüzeyde 15.0:1 (saf beyazdan yumuşak) |
| Sönük yazı | `#93A4B5` | zeminde 7.5:1, yüzeyde 6.9:1 |
| Vurgu | `#33C9DC` | zeminde 9.6:1; yalnızca düğme, etkin öğe, bağlantı, odak |
| Vurgu üstü yazı | `#06222A` | dolu vurgu düğmesinde, 8.3:1 |
| Kendi balonum | `#0F3A47` | üstünde yazı 10.4:1 |
| Tehlike | `#F87171` | yüzeyde 6.3:1 |
| Çevrimiçi | `#34D399` | yüzeyde 9.1:1 |

### 7.2 Yüzeyler ve derinlik

Kenarlık önce, gölge sonra: kartların 1px ince kenarlığı ve üst kenarda çok hafif bir aydınlık çizgisi (`inset 0 1px 0 rgba(255,255,255,.05)`); dış parlama yok. Listeler (kişiler, hesaplar) bir yüzey içinde ve satır ayraçlıdır.

### 7.3 Durum etiketleri, avatarlar, katmanlar

- Durum etiketleri (Onaylı / Onay bekliyor / Reddedildi / Kapatıldı) koyu zemin üstüne açık yazı ile yeniden renklendirilir; her biri metin içerdiği için renk tek başına anlam taşımaz (renk körlüğü).
- Avatar renkleri bugün 8 doygun renk ve beyaz harf (örneğin turuncu üstünde beyaz bugün de düşük kontrast). Koyu temada bu renkler **soldurulur ve bir ton ailesine** çekilir; harf kontrastı ölçülür. Ön izlemede en gürültülü öğe bu olduğu için bilinçli bir iyileştirme.
- Pencere arkası (scrim) koyulaşır; odak halkası vurgu renginde; `color-scheme: dark` ile kaydırma çubukları ve form denetimleri de koyu olur.

### 7.4 Tema menüsüne hazırlık (şimdi yapılan kısım)

Belirteçler `:root[data-theme="koyu"]` altında; `index.html` kökü `data-theme="koyu"` ile açılır. **Hiçbir bileşen renk değeri taşımaz**, hepsi belirteç kullanır. Menü eklenirken yalnızca (a) yeni bir tema bloğu, (b) seçimi saklamak (kullanıcı başına, bilgisayarda), (c) seçim kontrolü gerekir.

### 7.5 Masaüstü sayfaları ve pencere

`connect.html` ve `welcome.html` kendi iç CSS'lerinde aynı belirteçleri kullanır. Üç yerde aynı değerlerin elle tekrarlanıp kaymaması için bir **eşitlik testi** (`node:test`) belirteç değerlerini üç dosyadan okuyup karşılaştırır. Pencerenin ilk boyanışı koyudur (`BrowserWindow.backgroundColor`), böylece açılışta beyaz parlama olmaz.

## 8. Builder'a bırakılanlar

Son palet değerleri (özellikle durum etiketleri, avatar paleti, kendi balonum, gölge ve kenarlık alfaları) **ölçerek** kesinleştirilir; her yazı/zemin çifti için bir kontrast testi yazılır (belirteçleri CSS'ten okuyup WCAG oranını hesaplar, 4.5'in altı testi kırar). Etkileşim durumları (üzerine gelme, basılı, devre dışı, odak). `style.css` içindeki 24 sabit rengin belirtece taşınması. Üç dosya arasındaki belirteç eşitlik testi. `index.html` ve `meta color-scheme`. Playwright ile ekran görüntüleri (giriş, PIN, sohbet, hesap ekranı, onay penceresi, bağlantı ve ilk açılış sayfaları) ve ölçüm.

## 9. Riskler

- **Göz rahatlığı gerçek ekranda denenmeden bilinemez.** Okul monitörleri ve parlak sınıflar farklıdır; bu yüzden "sonra menü" kararı doğru: beğenilmezse açık tema geri gelebilir. Kullanıcı denemesi gerekir.
- **Windows başlık çubuğu** (pencerenin en üstü) açık kalabilir; koyu yapmak için `nativeTheme.themeSource = 'dark'` denenecek ama bu Electron'a bağlıdır, Linux'ta denenemez, garanti verilmez. Açık kalırsa bilinen sınır olarak yazılır.
- Mac'te hiçbir şey denenmedi (okulda Mac yok).
- Koyu temada `box-shadow`ların etkisi azalır; derinlik kenarlıkla kurulduğu için listelerde ve kartlarda kenarlık kaybolmamalı (§7.2).
