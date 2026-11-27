# İlk Bağlantı Bilgi Ekranı ve Giriş Açıklamaları (kısa tasarım)

Tarih: 2026-11-27
Durum: onaylandı (kullanıcı, 2026-11-27); 0.6.2 sürümünde çıkacak
İlgili: `2026-11-26-sunucu-kimligi-design.md` (§7.5 düzeltmesi: tek sunucuya otomatik bağlanma), `2026-11-27-koyu-tema-design.md`

## 1. Amaç ve neden

İlk gerçek denemede (27 Kasım, Windows istemci) onay ekranlarından sonra uygulama sunucuya **bir anda** bağlandı ve sohbet açıldı. Kullanıcı bunu kaba buldu: *"zart diye bağlanmasın"*, ağda sunucunun otomatik bulunduğunu gösteren bir bilgi ekranı istedi. Ayrıca giriş ekranında *"kaydınız varsa şöyle, yoksa şöyle"* diye açıklayıcı bilgi istedi; okuldaki herkes bilgisayar kullanımında rahat değil.

## 2. Hedefler

- Hatırlanan sunucu yokken ağda tek sunucu bulunursa, **bağlanmadan önce** bir bilgi ekranı çıkar: sunucunun adı ve adresi, ne olacağı, kısa bir geri sayım; kullanıcı beklemeden bağlanabilir ya da başka adres yazabilir.
- Giriş ve kayıt ekranları, hangi durumda ne yapılacağını sade Türkçe ile anlatır.
- Tık gerektirmez: bilgi ekranı kendiliğinden devam eder (kullanıcının "en az iş" isteği).

## 3. Kapsam dışı

Her açılışta bilgi ekranı göstermek (yalnızca **ilk** bağlanış); sunucu seçimi, kimlik doğrulaması ya da PIN akışında değişiklik; giriş ekranının yeniden tasarımı (yalnızca metin).

## 4. Anti-hedefler

- Her açılışta kullanıcıyı bekletmek ya da ek tıklama istemek.
- Bilgi ekranının güvenlik denetimlerini (kimlik doğrulama, sabitleme) atlaması: bağlanma yine doğrulanmış yoldan geçer.
- Elle adres yazmaya çalışan kullanıcının 10 sn'lik arka plan denemesiyle yeniden yeniden bilgi ekranına çekilmesi.

## 5. Kısıtlar

- Yeni bağımlılık yok. Tema belirteçleri kullanılır (`connect.html` kendi belirteç kopyasını taşır, `theme-sync.test.js` bozulmaz). Metinler Türkçe.
- Bilgi ekranı masaüstü uygulamasındadır (Electron, gerçek denemesi kullanıcıda); giriş açıklamaları web arayüzündedir ve **sunucudan gelir** (sunucu güncellenmeden görünmez).

## 6. Kararlar

### 6.1 "Sunucu bulundu" ekranı (`connect.html`, yeni `found` görünümü)

> **Ağda bir sunucu buldum.**
> *<sunucu adı>* · *<adres>*
> Bu bilgisayar bu sunucuya bağlanacak ve bir dahaki sefere kendiliğinden bağlanacak.
> **[ Bağlan ]**  Başka bir adres yaz
> *<N>* saniye içinde kendiliğinden bağlanır.

- **Ne zaman:** `resolveServer` hatırlanan kimlik yokken **tam bir** sunucu bulup `ok` döndüğünde (0.6.1'in tek sunucuya otomatik bağlanma kuralı). Hatırlanan sunucuya bağlanan sonraki açılışlarda **çıkmaz**.
- **Geri sayım 5 saniye**, `aria-live="polite"` ile okunur; "Bağlan" hemen bağlanır (varsayılan odak); "Başka bir adres yaz" geri sayımı durdurur ve elle adres kutusunu açar.
- **Bağlanma:** bilgi ekranı bağlanmayı **kendisi yapmaz**; mevcut doğrulanmış yolu kullanır (`submitServer(url)` → kimlik sorgusu → sabitleme → açma). Bu yüzden kimlik "değişti" ekranı ya da hata aynen çalışır.
- **Vazgeçince:** "Başka bir adres yaz" seçildiyse ana süreç o adresi oturum boyunca bilgi ekranı için **unutur** (10 sn'lik arka plan denemesi aynı sunucuyu yeniden önermez); kullanıcı bağlanınca ya da "Başka bir sunucuya bağlan…" kullanılınca sıfırlanır.
- Sunucu adı keşif yanıtından gelir, yoksa adresin ana makine adı yazılır; ağdan gelen metin yalnızca `textContent` ile basılır.
- Arka plan yeniden deneme (10 sn) elle adres sayfasındaki kullanıcıya **bilgi ekranını** gösterir (bir anda geçirmez); bu ekran zaten geri sayımlı ve çıkışlıdır.

### 6.2 Giriş ekranı açıklamaları (web)

Altında sönük (`--muted`) yazıyla:

- **Giriş:** "Hesabın varsa kullanıcı adın ve şifrenle gir. İlk girişte bu bilgisayar için 4 haneli bir PIN belirlersin; sonra yalnızca PIN ile girersin. Hesabın yoksa aşağıdaki "Hesabım yok, kayıt olmak istiyorum"a bas."
- **Kayıt:** "Kullanıcı adını ve şifreni yaz. Hesabın, yönetici onaylayınca açılır; o zamana kadar giriş yapamazsın. Onaylandığında aynı kullanıcı adı ve şifrenle giriş yap. (Bu sunucuya ilk kayıt olan kişi yönetici olur ve onay beklemeden girer.)"
- **Onay bekleme:** bugünkü metin kalır; eklenir: "Yöneticinin seni onaylaması gerekiyor; gecikirse yöneticiye haber ver."
- **PIN ekranı** *(benim kararım)*: "PIN'ini unuttuysan "Farklı hesapla giriş yap"a basıp şifrenle gir."

Doğrulandı (kod okunarak): ilk kayıt yönetici olup doğrudan girer, sonrakiler onay bekler; ilk girişten sonra PIN belirlenir.

## 7. Builder'a bırakılanlar

`resolveServer` sonucuna eklenecek alanların adları (`name`, `autoPicked`), `connect.html`'de yeni görünümün ayrıntısı ve geri sayım uygulaması, bilgi ekranının unutulması için küçük bir IPC, ve metin sabitlerinin web'de nerede durduğu (testlenebilir bir modül).

## 8. Riskler

- Elektron'a bağlı akış otomatik testle kapsanmaz; karar mantığı (`resolveServer`) test edilir, gerisi Playwright ölçümü ve kod okuma ile; gerçek deneme kullanıcıda.
- Geri sayım ile 10 sn'lik arka plan denemesi çakışırsa ekran sıfırlanıp yeniden başlayabilir: arka plan denemesi, bilgi ekranı zaten gösterilen adres için yeni bilgi ekranı açmamalıdır.
