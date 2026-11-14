# Arayüz Ergonomisi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ipchat'i bilgisayarla arası iyi olmayan bir okul personelinin kazasız kullanabileceği hale getirmek: yıkıcı işlemlerde onay, okunabilir sohbet, aranabilir listeler, adı işini anlatan tepsi menüsü.

**Architecture:** Mevcut bileşenler yerinde kalır, davranışlar noktasal düzeltilir. Test edilebilir karar mantığı (saat/tarih biçimleme, arama süzmesi, onay penceresinin sonucu, yenilemenin duraklaması) saf işlevlere çıkarılır ve `node:test` ile sınanır; React ve Electron katmanı bu işlevleri çağıran ince bir kabuk olarak kalır — depoda DOM/Electron test altyapısı yok.

**Tech Stack:** React 18 + zustand + düz CSS (Vite), Node.js `node:sqlite` sunucu, Electron 45.3.2, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-14-arayuz-ergonomisi-design.md`

## Global Constraints

- Yeni bağımlılık yok. Testler yalnızca `node:test`.
- Node.js >= 22.5; Electron tam olarak 45.3.2 (değiştirilmez).
- Tüm kullanıcıya görünen metinler Türkçe; saat biçimi 24 saat, tarih biçimi Türkçe.
- `POLL_MS = 3000` değişmez; okunmamış mesaj mantığı (0.3.0) bozulmaz.
- Pencere 800x620 sabit; `.chat-app` 780x560 düzeni ve mevcut renk değişkenleri korunur.
- Onay penceresinin varsayılan ve iptal düğmesi her zaman **Vazgeç**.
- `app:*` IPC `isServerSender`, `server:*` IPC `isTrustedSender` koruması gevşetilmez.
- Commit mesajlarının sonunda, boş satırdan sonra birebir:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YLavgjuvpq1b8f62aHefF1
```

## Review Focus

1. **Mesaj zamanı UTC olarak saklanıyor.** `messages.created_at`, SQLite `datetime('now')` ile yazılır: `"2026-11-14 09:03:00"`, UTC, saat dilimi işareti yok. `new Date(...)` bu dizeyi **yerel** saat sayar; Türkiye'de saatler 3 saat yanlış görünür. Biçimleyici dizeyi açıkça UTC kabul etmeli (Görev 2).
2. **Bozuk veya eksik tarih** (`null`, boş dize, anlamsız metin) sohbeti çökertmemeli, `Invalid Date` yazmamalı; boş dönmeli (Görev 2).
3. **Türkçe arama.** `İ/ı/I/i`, `ş`, `ğ` büyük-küçük eşleşmesi kullanıcının beklediği gibi olmalı: `"ışık"` yazınca `Işık` bulunmalı (Görev 2).
4. **Onay penceresinden kaçış.** Escape tuşu ve arka plana tıklama **her zaman iptal** etmeli, asla onaylamamalı (Görev 3).
5. **Duraklatılan yenileme kilitlenmemeli.** Fare listenin üstündeyken pencere odağını kaybederse (alt-tab) `mouseleave` gelmeyebilir; liste sonsuza dek bayat kalmamalı — pencere odakta değilken duraklatma düşmeli (Görev 3).

---

### Task 1: Sunucu — hesap listesinde çevrimiçi bilgisi

**Files:**
- Modify: `server/src/admin.js:10-21` (`listUsers`)
- Test: `server/test/admin.test.js`

**Interfaces:**
- Consumes: `server/src/sockets/presence.js` → `isOnline(userId: number): boolean`
- Produces: `GET /api/admin/users` satırlarına `online: boolean` alanı. Görev 4 bunu okur.

- [ ] **Step 1: Write the failing test**

`server/test/admin.test.js` içine ekle:

```js
test('admin kullanici listesi cevrimici alanini tasir', async () => {
  const r = await call('GET', '/api/admin/users', admin.token);
  assert.equal(r.status, 200);
  for (const u of r.body) assert.equal(typeof u.online, 'boolean');
  assert.equal(r.body.every((u) => u.online === false), true);
});
```

(Testte soket bağlantısı yok, bu yüzden herkes çevrimdışıdır; alanın var olduğunu ve türünü sabitler.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test test/admin.test.js`
Expected: FAIL — `typeof u.online` `undefined`.

- [ ] **Step 3: `listUsers()` dönüşüne `online` ekle**

`server/src/admin.js` içinde `isOnline`'ı `./sockets/presence.js`'den içe aktar ve eşlemeye `online: isOnline(u.id)` ekle. Başka alan değişmez.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server`
Expected: PASS — tüm sunucu testleri.

- [ ] **Step 5: Commit**

```bash
git add server/src/admin.js server/test/admin.test.js
git commit -m "feat(sunucu): hesap listesine cevrimici bilgisi"
```

---

### Task 2: Web — biçimleme ve arama yardımcıları (saf)

**Files:**
- Create: `web/src/lib/format.js`
- Test: `web/test/format.test.js`

**Interfaces:**
- Produces (hepsi adlandırılmış dışa aktarım, varsayılan dışa aktarım yok, içe aktarımı olmayan yaprak modül):
  - `messageTime(createdAt: string): string` — `"14:32"`, geçersizse `''`.
  - `dayKey(createdAt: string): string` — gün karşılaştırması için `"2026-11-14"`, geçersizse `''`.
  - `dayLabel(createdAt: string, now?: Date): string` — `"Bugün"`, `"Dün"`, `"12 Kasım"`, farklı yılsa `"12 Kasım 2025"`, geçersizse `''`.
  - `matchesSearch(text: string, query: string): boolean` — Türkçe duyarsız karşılaştırma; boş sorgu her şeyi eşler.

- [ ] **Step 1: Write the failing test**

`web/test/format.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageTime, dayKey, dayLabel, matchesSearch } from '../src/lib/format.js';

// SQLite datetime('now') UTC uretir, saat dilimi isareti yoktur.
const UTC = '2026-11-14 09:03:00';

test('messageTime dizeyi UTC sayar ve 24 saat bicimiyle yazar', () => {
  const beklenen = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date('2026-11-14T09:03:00Z'));
  assert.equal(messageTime(UTC), beklenen);
});

test('messageTime gecersiz girdide bos doner', () => {
  for (const v of [null, undefined, '', 'abc', {}]) assert.equal(messageTime(v), '');
});

test('dayKey ayni gunun iki mesajinda esittir, ertesi gunde farklidir', () => {
  assert.equal(dayKey('2026-11-14 09:03:00'), dayKey('2026-11-14 21:40:00'));
  assert.notEqual(dayKey('2026-11-14 23:59:00'), dayKey('2026-11-15 00:01:00'));
  assert.equal(dayKey('abc'), '');
});

test('dayLabel bugun ve dun icin kelime, oncesi icin tarih yazar', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(dayLabel('2026-11-14 09:03:00', now), 'Bugün');
  assert.equal(dayLabel('2026-11-13 09:03:00', now), 'Dün');
  assert.equal(dayLabel('2026-11-12 09:03:00', now), '12 Kasım');
});

test('dayLabel farkli yilda yili da yazar', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(dayLabel('2025-11-12 09:03:00', now), '12 Kasım 2025');
});

test('dayLabel gecersiz girdide bos doner', () => {
  assert.equal(dayLabel('abc'), '');
});

test('matchesSearch Turkce buyuk-kucuk harfi dogru esler', () => {
  assert.equal(matchesSearch('Işık', 'ışık'), true);
  assert.equal(matchesSearch('ışık', 'IŞIK'), true);
  assert.equal(matchesSearch('İnci', 'inci'), true);
  assert.equal(matchesSearch('Çağla', 'çağ'), true);
});

test('matchesSearch bos sorguda her seyi esler, eslesmeyende false doner', () => {
  assert.equal(matchesSearch('Ahmet', ''), true);
  assert.equal(matchesSearch('Ahmet', '   '), true);
  assert.equal(matchesSearch('Ahmet', 'zeynep'), false);
  assert.equal(matchesSearch('', 'a'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && node --test test/format.test.js`
Expected: FAIL — `../src/lib/format.js` bulunamadı.

- [ ] **Step 3: `web/src/lib/format.js` dosyasını yaz**

Ortak bir ayrıştırıcı: gelen dize `"YYYY-MM-DD HH:MM:SS"` ise boşluk `T` yapılıp sonuna `Z` eklenerek UTC olarak `new Date`'e verilir; sonuç `Number.isNaN(date.getTime())` ise geçersiz sayılır. Biçimleme `Intl.DateTimeFormat('tr-TR', …)` ile, `hour12: false`. Karşılaştırmalar yerel güne göre yapılır (kullanıcı kendi saatini görür). `matchesSearch` iki tarafı da `toLocaleLowerCase('tr')` ile küçültüp `includes` uygular, sorgunun baş/son boşluğu atılır.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/format.js web/test/format.test.js
git commit -m "feat(web): saat, tarih ve Turkce arama yardimcilari"
```

---

### Task 3: Web — onay penceresi ve yenileme duraklatma mantığı

**Files:**
- Create: `web/src/lib/dialog.js`
- Create: `web/src/components/ConfirmDialog.jsx`
- Test: `web/test/dialog.test.js`
- Modify: `web/src/style.css` (onay penceresi düğme biçimleri)

**Interfaces:**
- Produces:
  - `dialogOutcome({ key, isBackdrop }): 'cancel' | null` — `key === 'Escape'` ya da `isBackdrop === true` ise `'cancel'`, değilse `null`. Onay yalnızca düğmeye basarak olur, bu işlev asla `'confirm'` dönmez.
  - `pollingPaused({ hovering, windowFocused }): boolean` — yalnızca `hovering && windowFocused` iken `true`.
  - `ConfirmDialog({ message, confirmLabel, onConfirm, onCancel })` — React bileşeni. Mevcut `.modal-overlay` / `.modal` kalıbını kullanır; iki düğme: `confirmLabel` (yıkıcı, ikincil görünüm) ve `Vazgeç` (birincil, odaklanmış). Görev 4 kullanır.

- [ ] **Step 1: Write the failing test**

`web/test/dialog.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogOutcome, pollingPaused } from '../src/lib/dialog.js';

test('Escape ve arka plan tiklamasi her zaman iptal eder', () => {
  assert.equal(dialogOutcome({ key: 'Escape' }), 'cancel');
  assert.equal(dialogOutcome({ isBackdrop: true }), 'cancel');
  assert.equal(dialogOutcome({ key: 'Escape', isBackdrop: true }), 'cancel');
});

test('Enter ve diger tuslar onaylamaz', () => {
  for (const key of ['Enter', ' ', 'a', 'Tab']) assert.equal(dialogOutcome({ key }), null);
  assert.equal(dialogOutcome({}), null);
});

test('yenileme yalnizca fare listede VE pencere odaktayken duraklar', () => {
  assert.equal(pollingPaused({ hovering: true, windowFocused: true }), true);
  assert.equal(pollingPaused({ hovering: true, windowFocused: false }), false);
  assert.equal(pollingPaused({ hovering: false, windowFocused: true }), false);
  assert.equal(pollingPaused({ hovering: false, windowFocused: false }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && node --test test/dialog.test.js`
Expected: FAIL — `../src/lib/dialog.js` bulunamadı.

- [ ] **Step 3: `web/src/lib/dialog.js` dosyasını yaz**

Yukarıdaki iki işlev; içe aktarımı olmayan yaprak modül.

- [ ] **Step 4: `web/src/components/ConfirmDialog.jsx` bileşenini yaz**

`GroupCreateModal.jsx`'teki yapıyı izler: `.modal-overlay` üzerine tıklama ve `Escape` tuşu `dialogOutcome` ile değerlendirilip `onCancel` çağırır (`onClick` olayında `e.target === e.currentTarget` ile arka plan ayırt edilir). Pencere açılınca **Vazgeç** düğmesi odaklanır. Düğme sırası: solda yıkıcı işlem (`confirmLabel`), sağda `Vazgeç`.

- [ ] **Step 5: `style.css` içine onay penceresi düğme biçimleri ekle**

`.btn-danger` (sönük kırmızı zemin, `--danger` metin) ve `.btn-secondary`; ikisi de en az 32px yükseklik.

- [ ] **Step 6: Run tests and build**

Run: `npm test -w web && npm run build`
Expected: PASS ve derleme temiz.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/dialog.js web/src/components/ConfirmDialog.jsx web/test/dialog.test.js web/src/style.css
git commit -m "feat(web): onay penceresi ve yenileme duraklatma mantigi"
```

---

### Task 4: Web — hesap onay ekranı yeniden düzenlenir

Bu görevin mantığı Görev 2 ve 3'te test edildi; buradaki iş bağlantıdır. Doğrulama `npm run build` ve `npm test -w web` ile yapılır, yeni otomatik test eklenmez (depoda DOM test altyapısı yok).

**Files:**
- Modify: `web/src/components/AdminPanel.jsx` (tamamı)
- Modify: `web/src/lib/api.js` (gerekirse yeni uç yok; mevcut `adminListUsers` kullanılır)
- Modify: `web/src/style.css` (durum etiketleri, arama kutusu, satır düzeni)

**Interfaces:**
- Consumes: Görev 1 → `online: boolean`; Görev 2 → `matchesSearch`; Görev 3 → `ConfirmDialog`, `pollingPaused`.

- [ ] **Step 1: Durum etiketlerini ve çevrimiçi göstergesini değiştir**

`STATUS_LABELS` → `{ active: 'Onaylı', pending: 'Onay bekliyor', rejected: 'Reddedildi', disabled: 'Kapatıldı' }`. Her satırda ayrıca `u.online ? 'Çevrimiçi' : 'Çevrimdışı'` gösterilir. Durum, metin yerine renkli etiket (`.chip.chip-ok` yeşil, `.chip.chip-wait` sarı, `.chip.chip-off` gri) olur.

- [ ] **Step 2: Bekleyen hesapları öne çıkar**

Başlık `Bekleyen hesaplar (N)`; `N === 0` ise tek satır `Bekleyen hesap yok.`. İkinci bölüm `Tüm hesaplar`.

- [ ] **Step 3: Düğme hiyerarşisini kur**

`Onayla` birincil dolgulu düğme; `Reddet`, `Kapat`, `Yöneticiliği al` ikincil. `Aç` ve `Yönetici yap` ikincil kalır.

- [ ] **Step 4: Yıkıcı işlemlere onay penceresi tak**

`Reddet`, `Kapat`, `Yöneticiliği al` tıklanınca `ConfirmDialog` açılır; işlem yalnızca onaylanınca çalışır. Metinler birebir:
- Reddet: `<ad> adlı hesap reddedilsin mi? Bu kişi giriş yapamaz.`
- Kapat: `<ad> adlı hesap kapatılsın mı? Açık oturumları sonlandırılır.`
- Yöneticiliği al: `<ad> kişisinin yöneticiliği alınsın mı?`
`Onayla`, `Aç`, `Yönetici yap` onaysız çalışır.

- [ ] **Step 5: Arama kutusu ekle**

Listenin üstünde tek satır, etiketi `Hesap ara`; `matchesSearch(u.username, query)` ile iki bölümü de süzer.

- [ ] **Step 6: Yenilemeyi fare listedeyken duraklat**

Liste kapsayıcısına `onMouseEnter`/`onMouseLeave`, pencereye `focus`/`blur` dinleyicileri; her yenileme turunda `pollingPaused({ hovering, windowFocused })` doğruysa istek atlanır. Dinleyiciler temizlikte kaldırılır.

- [ ] **Step 7: Hata mesajını işlemin yanında göster**

Hata, ilgili satırın altında görünür (satır kimliğiyle eşleşen durum); üstteki genel hata yalnızca liste yüklenemediğinde kalır.

- [ ] **Step 8: Verify**

Run: `npm test -w web && npm run build`
Expected: PASS, derleme temiz.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/AdminPanel.jsx web/src/style.css
git commit -m "feat(web): hesap ekrani - onayli etiketi, cevrimici, onay penceresi, arama"
```

---

### Task 5: Web — sohbette saat, gönderen adı ve gün ayracı

Mantığı Görev 2'de test edildi; burada bağlantı yapılır. Doğrulama derleme ile.

**Files:**
- Modify: `web/src/components/ChatWindow.jsx:76-91` (mesaj listesi)
- Modify: `web/src/style.css` (mesaj alt bilgisi, gün ayracı)

**Interfaces:**
- Consumes: Görev 2 → `messageTime`, `dayKey`, `dayLabel`.

- [ ] **Step 1: Gün ayracı ekle**

Listeyi dolaşırken önceki mesajın `dayKey`'i farklıysa, mesajdan önce `<div className="day-separator">{dayLabel(m.created_at)}</div>` basılır. `dayLabel` boş dönerse ayraç basılmaz.

- [ ] **Step 2: Saat ekle**

Her mesaj balonunun altında `<span className="message-time">{messageTime(m.created_at)}</span>`; boşsa yazılmaz.

- [ ] **Step 3: Grup sohbetinde gönderen adını göster**

`activeConversation.type === 'group'` ve `m.sender_id !== currentUser.id` ise balonun üstünde gönderenin kullanıcı adı. Ad `useStore.getState().contacts` içinden bulunur; bulunamazsa yazılmaz. Kişi sohbetinde hiç yazılmaz.

- [ ] **Step 4: CSS**

`.day-separator` ortalı, küçük, sönük, üstünde/altında boşluk; `.message-time` 0.75rem, sönük, balonun sağ altında; `.message-sender` 0.8rem, yarı kalın.

- [ ] **Step 5: Verify**

Run: `npm test -w web && npm run build`
Expected: PASS, derleme temiz.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ChatWindow.jsx web/src/style.css
git commit -m "feat(web): sohbette saat, gonderen adi ve gun ayraci"
```

---

### Task 6: Web — kişi listesinde arama

Mantığı Görev 2'de test edildi. Doğrulama derleme ile.

**Files:**
- Modify: `web/src/components/ContactList.jsx`
- Modify: `web/src/style.css` (arama kutusu)

**Interfaces:**
- Consumes: Görev 2 → `matchesSearch`.

- [ ] **Step 1: Arama kutusunu ekle**

Listenin en üstünde tek satırlık kutu, etiketi `Kişi ara`. Hem `contacts` hem `groups` süzülür (`matchesSearch(c.username, q)` / `matchesSearch(g.name, q)`).

- [ ] **Step 2: Boş sonuç durumu**

Süzme sonucu her iki liste de boşsa `Eşleşen kişi veya grup yok.` yazılır.

- [ ] **Step 3: Sıralama ve okunmamış noktaları korunur**

Mevcut sıralamaya ve `unread` göstergelerine dokunulmaz; yalnızca süzme uygulanır.

- [ ] **Step 4: Verify**

Run: `npm test -w web && npm run build`
Expected: PASS, derleme temiz.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ContactList.jsx web/src/style.css
git commit -m "feat(web): kisi ve grup listesinde arama"
```

---

### Task 7: Web — giriş ekranı etiketleri ve PIN düğmesi

**Files:**
- Modify: `web/src/pages/LoginScreen.jsx:82-93`
- Modify: `web/src/components/PinPad.jsx:39-41`
- Modify: `web/src/style.css` (form etiketi)

- [ ] **Step 1: Kalıcı etiketler ekle**

Kullanıcı adı ve şifre kutularının üstüne `<label>` (`Kullanıcı adı`, `Şifre`), `htmlFor`/`id` ile bağlı. Placeholder'lar kaldırılır (biçim ipucu değiller).

- [ ] **Step 2: PIN ekranındaki yinelenen düğmeyi kaldır**

`PinPad.jsx` içindeki alttaki `submitLabel` düğmesi silinir; tuş takımındaki `✓` kalır ve `pin.length === 4` değilken etkisizdir. `submitLabel` özelliği artık kullanılmıyorsa imzadan da çıkarılır ve çağıran yerler (`LoginScreen.jsx`) güncellenir.

- [ ] **Step 3: CSS**

`.field-label` 0.85rem, `--text` rengi, kutunun üstünde 4px boşluk.

- [ ] **Step 4: Verify**

Run: `npm test -w web && npm run build`
Expected: PASS, derleme temiz.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/LoginScreen.jsx web/src/components/PinPad.jsx web/src/style.css
git commit -m "feat(web): giris ekraninda kalici etiketler, PIN'de tek gonder yolu"
```

---

### Task 8: Web — okunabilirlik geçişi

**Files:**
- Modify: `web/src/style.css` (değişkenler ve ortak biçimler)

- [ ] **Step 1: Sönük rengi koyulaştır**

`:root` içinde `--muted: #8b93a7` → `#6b7280`. (Beyaz üzerinde kontrast ~3:1'den ~4.6:1'e çıkar.)

- [ ] **Step 2: Tıklama hedeflerini büyüt**

`.link` ve satır içi işlem düğmeleri en az `32px` yükseklik (`min-height: 32px`, dikey dolgu buna göre).

- [ ] **Step 3: Hata metnini büyüt**

`.error` `font-size: 0.85rem` → `0.9rem`.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: Derleme temiz.

Ayrıca gözle denetle: `--muted` kullanan yerlerde (`.subtitle`, `.section-header`, `.message-time`, `.day-separator`) metin hâlâ ikincil görünüyor, birincil metinle karışmıyor.

- [ ] **Step 5: Commit**

```bash
git add web/src/style.css
git commit -m "feat(web): okunabilirlik - kontrast, tiklama hedefi, hata metni"
```

---

### Task 9: Masaüstü — tepsi menüsü

**Files:**
- Modify: `desktop/src/tray-state.js` (yeni saf yardımcı)
- Modify: `desktop/src/tray.js` (menü)
- Modify: `desktop/src/main.js` (onay, bağlı sunucu adı)
- Test: `desktop/test/tray-state.test.js`

**Interfaces:**
- Consumes: mevcut `applyState`, `alertCount`, `tooltipLines`; `server-guard.js` → `HOST_CONFIRM` kalıbı.
- Produces: `connectionLine(state): string` — `state.connected` doğruysa `Bağlı: <serverLabel>`, `serverLabel` boş ya da yoksa `Bağlı: sunucu`; `state.connected` yanlış ya da yoksa `Bağlı değil`. `state`'e `connected: boolean` ve `serverLabel: string` eklenir.

- [ ] **Step 1: Write the failing test**

`desktop/test/tray-state.test.js` içine ekle:

```js
test('connectionLine bagli sunucunun adini yazar', () => {
  assert.equal(connectionLine({ connected: true, serverLabel: 'mudur-pc' }), 'Bağlı: mudur-pc');
});

test('connectionLine bagli degilken sabit metin yazar', () => {
  assert.equal(connectionLine({ connected: false, serverLabel: 'mudur-pc' }), 'Bağlı değil');
  assert.equal(connectionLine({}), 'Bağlı değil');
});

test('connectionLine ad bos ise genel bir sozcuk kullanir', () => {
  assert.equal(connectionLine({ connected: true, serverLabel: '' }), 'Bağlı: sunucu');
  assert.equal(connectionLine({ connected: true }), 'Bağlı: sunucu');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && node --test test/tray-state.test.js`
Expected: FAIL — `connectionLine` dışa aktarılmamış.

- [ ] **Step 3: `connectionLine(state)` işlevini `tray-state.js` içinde yaz**

- [ ] **Step 4: Menüyü yeniden düzenle**

`tray.js` içinde, `rebuild()` sırası:
1. `connectionLine(state)` — tıklanamaz (`enabled: false`), en üstte.
2. `Aç`
3. ayraç
4. Mevcut sunucu bölümü (çalışıyorsa adresler ve `Sunucu modunu kapat`; değilse `Bu bilgisayarı sunucu yap` ya da soluk `Ağda zaten bir sunucu var`)
5. `Sunucuyu değiştir` → **`Başka bir sunucuya bağlan…`**
6. ayraç
7. `Bilgisayar açılınca başlat`
8. ayraç
9. `Ipchat'i kaldır…`
10. `Çık`

`Çık` ile kaldırma arasındaki ayraç korunur; kaldırma en alt bölümdedir.

- [ ] **Step 5: `Başka bir sunucuya bağlan…` için onay ekle**

`main.js` içinde `changeServer`, `disableServerMode()` çağırmadan önce onay gösterir. `server-guard.js`'deki `HOST_CONFIRM` ile aynı kalıpta, metin birebir:
```
message: 'Şu anki sunucuyla bağlantın kesilecek.'
detail:  'Başka bir Ipchat sunucusuna bağlanmak için yeniden arama ekranı açılır. Devam edilsin mi?'
buttons: ['Devam et', 'Vazgeç'], defaultId: 1, cancelId: 1
```
Pencere gizliyse ya da küçültülmüşse onay penceresi sahipsiz açılır (`alive() && win.isVisible() ? win : undefined`) — 0.3.0'da düzeltilen macOS tuzağının aynısı.

- [ ] **Step 6: Bağlı sunucu adını tepsiye bildir**

`main.js` içinde `openServer(url)` sonrası `tray?.update({ connected: true, serverLabel: <ad> })`; `showConnectPage(...)` sonrası `connected: false`. Ad, keşif sonucundaki sunucu adı varsa o, yoksa URL'nin ana makine kısmıdır.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -w desktop`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop/src/tray-state.js desktop/src/tray.js desktop/src/main.js desktop/test/tray-state.test.js
git commit -m "feat(masaustu): tepside durum satiri, acik adlandirma ve onay"
```
