# Okunmamış Mesaj Noktası, Anlık Bildirim ve İkinci Sunucu Koruması — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Okunmamış mesajları sunucuda takip edip kişi/grup satırında nokta olarak göstermek, başkasından gelen mesaj için işletim sistemi bildirimi çıkarmak ve ağda zaten sunucu varken ikinci sunucu kurulmasını engellemek.

**Architecture:** Sunucuda sohbet başına `read_state(user_id, kind, peer_id, last_read_id)` tablosu; okunmamış sayısı `max(baseline, last_read_id)`'den büyük, benim göndermediğim mesajların sayısı. Web arayüzü mevcut 3 sn'lik yenilemeye `GET /api/unread` ekler ve `message:new` olayında sayacı anında artırır. Masaüstü köprüsü bildirim hedefi (`open`) ve okunmamış sayısı (`setUnread`) taşır. İkinci sunucu koruması, mevcut `resolveServer` keşif sonucuna ve her durumda gösterilen bir onay penceresine dayanır.

**Tech Stack:** Node.js >= 22.5 (`node:sqlite`, `node:test`), Express, Socket.IO, React + zustand + Vite, Electron 45.3.2.

**Spec:** `docs/superpowers/specs/2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md`

## Global Constraints

- Yeni bağımlılık eklenmez. Testler `node:test` ile yazılır.
- Node.js >= 22.5 (`node:sqlite`).
- Tüm kullanıcıya görünen metinler Türkçe.
- Yenileme aralığı `POLL_MS = 3000` değişmez; pencere 800x620 sabit kalır; B tasarımı korunur.
- Bildirim gövdesi mesaj içeriğini **asla** göstermez; sabit metin `Yeni mesaj`.
- Masaüstü köprüsü (`app:*` IPC) yalnızca bağlı sunucunun origin'inden gelen sayfaya açıktır (`isServerSender`); `server:*` IPC yalnızca `connect.html`'den (`isTrustedSender`).
- Commit mesajlarının sonuna ortamın verdiği `Co-Authored-By` ve `Claude-Session` satırları eklenir.

## Review Focus

1. **Uygulama kapalıyken gelen mesaj:** okunmamış sayısı yalnızca veritabanından hesaplanmalı — hiçbir istemci bağlı olmasa da mesaj sayılmalı (Görev 1'in tüm testleri soket kullanmadan çalışır).
2. **Kendi mesajım:** gönderdiğim mesaj bana hiçbir zaman okunmamış sayılmamalı, kişi sohbetinde de grupta da (Görev 1).
3. **Eski geçmişi olan kurulum:** yükseltmeden sonra ilk açılışta hiçbir sohbette nokta görünmemeli (baseline) (Görev 1).
4. **Yetkisiz okundu işareti:** üyesi olmadığım grup için `POST /api/read` 403, olmayan/aktif olmayan kişi için 404 (Görev 2).
5. **Bildirim spam'i:** açık ve odaktaki sohbete gelen mesaj bildirim üretmemeli; aynı kişiden 5 sn içinde gelen ikinci mesaj ikinci bildirim üretmemeli (Görev 3).

---

### Task 1: Sunucuda okunmamış mesaj takibi

**Files:**
- Modify: `server/src/db.js:50-64` (tablo ve indeks)
- Modify: `server/src/migrate.js:1-23` (baseline)
- Create: `server/src/unread.js`
- Test: `server/test/unread.test.js`

**Interfaces:**
- Consumes: `server/src/db.js` → `db`
- Produces:
  - `ensureUnreadBaseline(db): void` — `meta` tablosunu oluşturur, `unread_baseline_id` yoksa o anki en büyük mesaj kimliğini (mesaj tablosu yoksa 0) yazar. `migrate(db)` içinden çağrılır.
  - `unreadCounts(userId: number): Record<string, number>` — `{ 'user:3': 2, 'group:1': 5 }`, yalnızca sayısı > 0 olanlar.
  - `markRead(userId: number, type: 'user'|'group', id: number): void` — `UnreadError` fırlatabilir.
  - `class UnreadError extends Error { status: number }`

- [ ] **Step 1: Write the failing test**

`server/test/unread.test.js`:

```js
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.IPCHAT_DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const { unreadCounts, markRead, UnreadError, ensureUnreadBaseline } = await import('../src/unread.js');

const send = (senderId, type, recipientId, body = 'merhaba') =>
  Number(
    db
      .prepare(
        `INSERT INTO messages (sender_id, recipient_type, recipient_id, body) VALUES (?, ?, ?, ?)`
      )
      .run(senderId, type, recipientId, body).lastInsertRowid
  );

let ali, veli;
beforeEach(() => {
  db.exec('DELETE FROM read_state; DELETE FROM messages; DELETE FROM group_members; DELETE FROM groups; DELETE FROM sessions; DELETE FROM devices; DELETE FROM users; DELETE FROM meta;');
  ali = auth.register('ali', 'sifre123').userId;       // ilk kullanıcı: active
  veli = auth.register('veli', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(veli);
  ensureUnreadBaseline(db);
});

test('veliden gelen iki mesaj ali icin okunmamis sayilir', () => {
  send(veli, 'user', ali);
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 2 });
});

test('kendi gonderdigim mesaj bana okunmamis sayilmaz', () => {
  send(ali, 'user', veli);
  assert.deepEqual(unreadCounts(ali), {});
});

test('markRead noktayi temizler, sonraki mesaj yeniden sayilir', () => {
  send(veli, 'user', ali);
  markRead(ali, 'user', veli);
  assert.deepEqual(unreadCounts(ali), {});
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('grup mesaji uyeler icin sayilir, gonderen icin sayilmaz', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('ekip', ali).lastInsertRowid);
  for (const u of [ali, veli]) db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, u);
  send(veli, 'group', gid);
  assert.deepEqual(unreadCounts(ali), { [`group:${gid}`]: 1 });
  assert.deepEqual(unreadCounts(veli), {});
});

test('uyesi olmadigim grubun mesaji bana sayilmaz', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('gizli', veli).lastInsertRowid);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, veli);
  const uc = auth.register('ucuncu', 'sifre123').userId;
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(uc);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, uc);
  send(uc, 'group', gid);
  assert.deepEqual(unreadCounts(ali), {});
});

test('baseline oncesi eski mesajlar okunmus sayilir', () => {
  send(veli, 'user', ali);
  db.exec('DELETE FROM meta');
  ensureUnreadBaseline(db);          // yukseltme: o anki en buyuk id baseline olur
  assert.deepEqual(unreadCounts(ali), {});
  send(veli, 'user', ali);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('ensureUnreadBaseline ikinci cagrida baseline degistirmez', () => {
  send(veli, 'user', ali);
  ensureUnreadBaseline(db);
  assert.deepEqual(unreadCounts(ali), { [`user:${veli}`]: 1 });
});

test('markRead uyesi olmadigim grup icin 403 atar', () => {
  const gid = Number(db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run('gizli', veli).lastInsertRowid);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, veli);
  assert.throws(() => markRead(ali, 'group', gid), (err) => err instanceof UnreadError && err.status === 403);
});

test('markRead olmayan kisi icin 404 atar', () => {
  assert.throws(() => markRead(ali, 'user', 9999), (err) => err instanceof UnreadError && err.status === 404);
});

test('markRead aktif olmayan kisi icin 404 atar', () => {
  const bekleyen = auth.register('bekleyen', 'sifre123').userId;
  assert.throws(() => markRead(ali, 'user', bekleyen), (err) => err instanceof UnreadError && err.status === 404);
});

test('markRead gecersiz tur icin 400 atar', () => {
  assert.throws(() => markRead(ali, 'kanal', 1), (err) => err instanceof UnreadError && err.status === 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w server -- --test-name-pattern=okunmamis`
Expected: FAIL — `../src/unread.js` bulunamadı.

- [ ] **Step 3: `read_state` tablosunu ve sayım indeksini `server/src/db.js` içine ekle**

`messages` tablosundan sonra, mevcut `db.exec` bloğunun içine:

```sql
CREATE TABLE IF NOT EXISTS read_state (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('user','group')),
  peer_id INTEGER NOT NULL,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, peer_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (recipient_type, recipient_id, id);
```

- [ ] **Step 4: `ensureUnreadBaseline(db)` işlevini `server/src/unread.js` içinde yaz ve `migrate.js` sonundan çağır**

`meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)` tablosunu `CREATE TABLE IF NOT EXISTS` ile oluşturur. `unread_baseline_id` anahtarı varsa hiçbir şey yapmaz. Yoksa: `messages` tablosu varsa (`SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`) `SELECT COALESCE(MAX(id), 0) FROM messages`, yoksa 0 yazar.

`server/src/migrate.js` içinde `migrate(db)` gövdesinin sonuna `ensureUnreadBaseline(db);` eklenir (mevcut `db-migration.test.js` eski şema ile çağırdığı için `messages` tablosunun yokluğuna dayanıklı olmalı).

- [ ] **Step 5: `unreadCounts(userId)` işlevini `server/src/unread.js` içinde yaz**

Baseline `meta`'dan okunur. İki sorgunun sonucu tek nesnede birleşir:

```sql
-- kişi sohbetleri
SELECT m.sender_id AS peer, COUNT(*) AS n
FROM messages m
LEFT JOIN read_state r
  ON r.user_id = ? AND r.kind = 'user' AND r.peer_id = m.sender_id
WHERE m.recipient_type = 'user' AND m.recipient_id = ? AND m.sender_id != ?
  AND m.id > MAX(COALESCE(r.last_read_id, 0), ?)
GROUP BY m.sender_id;

-- grup sohbetleri
SELECT m.recipient_id AS peer, COUNT(*) AS n
FROM messages m
JOIN group_members gm ON gm.group_id = m.recipient_id AND gm.user_id = ?
LEFT JOIN read_state r
  ON r.user_id = ? AND r.kind = 'group' AND r.peer_id = m.recipient_id
WHERE m.recipient_type = 'group' AND m.sender_id != ?
  AND m.id > MAX(COALESCE(r.last_read_id, 0), ?)
GROUP BY m.recipient_id;
```

Anahtarlar `user:<peer>` / `group:<peer>`; sayısı 0 olan satır zaten dönmez.

- [ ] **Step 6: `markRead(userId, type, id)` ve `UnreadError` işlevlerini `server/src/unread.js` içinde yaz**

Doğrulama: `type` `'user'` veya `'group'` değilse `UnreadError(400, 'Geçersiz sohbet türü')`. `'group'` için `group_members` kaydı yoksa `UnreadError(403, 'Bu grubun üyesi değilsin')`. `'user'` için `users` içinde `status = 'active'` kayıt yoksa `UnreadError(404, 'Kişi bulunamadı')`.

Sonra o sohbetin en büyük mesaj kimliği (`'user'` için iki yönlü, `'group'` için grup mesajları; mesaj yoksa 0) ile upsert:

```sql
INSERT INTO read_state (user_id, kind, peer_id, last_read_id) VALUES (?, ?, ?, ?)
ON CONFLICT(user_id, kind, peer_id)
DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -w server`
Expected: PASS — yeni testler dahil tüm sunucu testleri geçer (`db-migration.test.js` dahil).

- [ ] **Step 8: Commit**

```bash
git add server/src/db.js server/src/migrate.js server/src/unread.js server/test/unread.test.js
git commit -m "feat(sunucu): okunmamis mesaj takibi (read_state tablosu ve baseline)"
```

---

### Task 2: `/api/unread` ve `/api/read` uçları

**Files:**
- Create: `server/src/routes/unread.js`
- Modify: `server/src/index.js:13-48` (router kaydı)
- Test: `server/test/unread-routes.test.js`

**Interfaces:**
- Consumes: Görev 1 → `unreadCounts(userId)`, `markRead(userId, type, id)`, `UnreadError`
- Produces: `unreadRouter` (named export), `app.use('/api', unreadRouter)` ile bağlanır.
  - `GET /api/unread` → `{ "user:3": 2 }`
  - `POST /api/read` gövde `{ type, id }` → `{ ok: true }`

- [ ] **Step 1: Write the failing test**

`server/test/unread-routes.test.js` — `admin.test.js`'deki express+http kalıbını kullanır (`process.env.IPCHAT_DB_PATH = ':memory:'`, `app.use(express.json())`, `app.use('/api', unreadRouter)`).

```js
test('kimliksiz istek 401 doner', async () => {
  assert.equal((await call('GET', '/api/unread', 'gecersiz')).status, 401);
});

test('GET /api/unread okunmamis sayilarini doner', async () => {
  send(veli, 'user', ali);
  const r = await call('GET', '/api/unread', aliToken);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { [`user:${veli}`]: 1 });
});

test('POST /api/read noktayi temizler', async () => {
  send(veli, 'user', ali);
  assert.equal((await post('/api/read', aliToken, { type: 'user', id: veli })).status, 200);
  assert.deepEqual((await call('GET', '/api/unread', aliToken)).body, {});
});

test('POST /api/read uyesi olunmayan grup icin 403 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'group', id: gizliGrupId })).status, 403);
});

test('POST /api/read olmayan kisi icin 404 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'user', id: 9999 })).status, 404);
});

test('POST /api/read gecersiz tur icin 400 doner', async () => {
  assert.equal((await post('/api/read', aliToken, { type: 'kanal', id: 1 })).status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w server -- --test-name-pattern=unread`
Expected: FAIL — `../src/routes/unread.js` bulunamadı.

- [ ] **Step 3: `server/src/routes/unread.js` dosyasını yaz**

`routes/messages.js` kalıbı: `const unreadRouter = Router(); unreadRouter.use(requireAuth);`. `GET /unread` → `res.json(unreadCounts(req.user.id))`. `POST /read` → `markRead(req.user.id, req.body?.type, Number(req.body?.id))`, `UnreadError` yakalanıp `res.status(err.status).json({ error: err.message })`, başarıda `{ ok: true }`.

- [ ] **Step 4: `server/src/index.js` içinde router'ı bağla**

`import { unreadRouter } from './routes/unread.js';` ve diğer `app.use('/api', ...)` satırlarının yanına `app.use('/api', unreadRouter);`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w server`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/unread.js server/src/index.js server/test/unread-routes.test.js
git commit -m "feat(sunucu): GET /api/unread ve POST /api/read uclari"
```

---

### Task 3: Web — okunmamış ve bildirim mantığı (saf işlevler)

**Files:**
- Create: `web/src/lib/unread.js`
- Test: `web/test/unread.test.js`

**Interfaces:**
- Produces:
  - `conversationKeyOf(message, myId): string` — `message.recipient_type === 'group'` ise `group:<recipient_id>`, değilse karşı tarafın kimliğiyle `user:<id>`.
  - `bumpUnread(counts, key): Record<string, number>` — yeni nesne döner, `key` sayısını 1 artırır.
  - `clearUnread(counts, key): Record<string, number>` — yeni nesne döner, `key`'i siler.
  - `totalUnread(counts): number`
  - `pageTitle(total): string` — `total > 0` ise `(3) Ipchat`, değilse `Ipchat`.
  - `shouldNotify({ message, myId, activeKey, focused }): boolean`
  - `shouldCoalesce(lastShownAt, now, windowMs = 5000): boolean`
  - `NOTIFY_COALESCE_MS = 5000`
  - `notificationFor(message, senderName, myId): { title, body, open }` — `{ title: senderName, body: 'Yeni mesaj', open: { type, id } }`; `open` değerleri `conversationKeyOf`'un ayrıştırılmış hali.

- [ ] **Step 1: Write the failing test**

`web/test/unread.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationKeyOf, bumpUnread, clearUnread, totalUnread, pageTitle,
  shouldNotify, shouldCoalesce, notificationFor, NOTIFY_COALESCE_MS,
} from '../src/lib/unread.js';

const fromVeli = { id: 7, sender_id: 2, recipient_type: 'user', recipient_id: 1 };
const benden = { id: 8, sender_id: 1, recipient_type: 'user', recipient_id: 2 };
const grup = { id: 9, sender_id: 2, recipient_type: 'group', recipient_id: 5 };

test('conversationKeyOf gelen kisi mesajinda gondereni kullanir', () => {
  assert.equal(conversationKeyOf(fromVeli, 1), 'user:2');
});

test('conversationKeyOf kendi gonderdigim mesajda aliciyi kullanir', () => {
  assert.equal(conversationKeyOf(benden, 1), 'user:2');
});

test('conversationKeyOf grup mesajinda grubu kullanir', () => {
  assert.equal(conversationKeyOf(grup, 1), 'group:5');
});

test('bumpUnread ve clearUnread yeni nesne doner', () => {
  const a = {};
  const b = bumpUnread(a, 'user:2');
  assert.deepEqual(a, {});
  assert.deepEqual(b, { 'user:2': 1 });
  assert.deepEqual(bumpUnread(b, 'user:2'), { 'user:2': 2 });
  assert.deepEqual(clearUnread(b, 'user:2'), {});
});

test('totalUnread ve pageTitle', () => {
  assert.equal(totalUnread({ 'user:2': 2, 'group:5': 1 }), 3);
  assert.equal(pageTitle(3), '(3) Ipchat');
  assert.equal(pageTitle(0), 'Ipchat');
});

test('kendi mesajim icin bildirim yok', () => {
  assert.equal(shouldNotify({ message: benden, myId: 1, activeKey: null, focused: false }), false);
});

test('acik ve odaktaki sohbet icin bildirim yok', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'user:2', focused: true }), false);
});

test('sohbet acik ama pencere arkadaysa bildirim var', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'user:2', focused: false }), true);
});

test('baska sohbet acikken pencere odakta olsa da bildirim var', () => {
  assert.equal(shouldNotify({ message: fromVeli, myId: 1, activeKey: 'group:5', focused: true }), true);
});

test('shouldCoalesce 5 sn icinde true, sonrasinda false', () => {
  assert.equal(NOTIFY_COALESCE_MS, 5000);
  assert.equal(shouldCoalesce(1000, 1000 + 4999), true);
  assert.equal(shouldCoalesce(1000, 1000 + 5000), false);
  assert.equal(shouldCoalesce(undefined, 1000), false);
});

test('notificationFor mesaj icerigini gostermez', () => {
  const n = notificationFor({ ...fromVeli, body: 'gizli sifre' }, 'veli', 1);
  assert.deepEqual(n, { title: 'veli', body: 'Yeni mesaj', open: { type: 'user', id: 2 } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w web`
Expected: FAIL — `../src/lib/unread.js` bulunamadı.

- [ ] **Step 3: `web/src/lib/unread.js` dosyasını yaz**

Yukarıdaki imzaları uygular. `shouldNotify` kuralı: mesaj benden değilse **ve** (`focused` yanlış **veya** `activeKey !== conversationKeyOf(message, myId)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/unread.js web/test/unread.test.js
git commit -m "feat(web): okunmamis mesaj ve bildirim mantigi"
```

---

### Task 4: Web — arayüz bağlantısı (nokta, bildirim, okundu işareti)

Bu görevin mantığı Görev 3'te test edildi; buradaki değişiklik bağlantı (wiring) ve CSS'tir. Doğrulama `npm run build` ve kullanıcının gerçek ortam denemesiyle yapılır; otomatik test eklenmez.

**Files:**
- Modify: `web/src/state/store.js:7-23,49-54` (durum ve eylemler)
- Modify: `web/src/lib/api.js:35-40` (yeni uçlar)
- Modify: `web/src/pages/ChatApp.jsx:29-76` (yenileme, soket, bildirim)
- Modify: `web/src/components/ContactList.jsx:16-49` (nokta ve kalın ad)
- Modify: `web/src/components/ChatWindow.jsx:16-24` (okundu işareti)
- Modify: `web/src/style.css` (`.unread-dot`, `.contact-item.unread`)

**Interfaces:**
- Consumes: Görev 2 → `GET /api/unread`, `POST /api/read`; Görev 3 → `web/src/lib/unread.js`; Görev 6 → `window.ipchat.setUnread`, `window.ipchat.onOpenConversation`
- Produces: store alanı `unread: Record<string, number>` ve eylemler `setUnread(counts)`, `markConversationRead(key)`.

- [ ] **Step 1: Store'a okunmamış durumunu ekle**

`web/src/state/store.js`: başlangıç durumuna `unread: {}`; `setUnread: (unread) => set({ unread })`; `markConversationRead: (key) => set((s) => ({ unread: clearUnread(s.unread, key) }))`; `bumpUnread: (key) => set((s) => ({ unread: bumpUnread(s.unread, key) }))` (adlar çakışmasın diye `web/src/lib/unread.js` içindeki saf işlevler `as` ile içe aktarılır). `logout` sıfırlamasına `unread: {}` eklenir.

- [ ] **Step 2: API istemcisine uçları ekle**

`web/src/lib/api.js` → `api` nesnesine:
```js
listUnread: () => request('/api/unread', { auth: true }),
markRead: (type, id) => request('/api/read', { method: 'POST', body: { type, id }, auth: true }),
```

- [ ] **Step 3: `ChatApp.jsx` içinde okunmamışları yenile, bildirimi ve başlığı yönet**

- Mevcut `stopContacts` poller'ının içine `api.listUnread()` eklenir (tek yenileme turunda hem kişiler hem sayılar); sonuç `setUnread(counts)`, `window.ipchat?.setUnread?.(totalUnread(counts))`, `document.title = pageTitle(totalUnread(counts))`.
- `socket.on('message:new', ...)` içinde: mevcut `appendMessage(message)` korunur; ardından `key = conversationKeyOf(message, currentUser.id)`. `shouldNotify({ message, myId: currentUser.id, activeKey, focused: document.hasFocus() })` doğruysa ve o gönderen için `shouldCoalesce(lastNotifiedAt[key], Date.now())` yanlışsa `window.ipchat?.notify?.(notificationFor(message, senderName, currentUser.id))` çağrılır ve `lastNotifiedAt[key] = Date.now()` güncellenir (`useRef` ile tutulan nesne). Aynı koşul doğruysa `bumpUnread(key)`; değilse (sohbet açık ve odakta) `api.markRead(...)` çağrılır.
  - `senderName`: `useStore.getState().contacts` içinde `message.sender_id`'ye karşılık gelen `username`; bulunamazsa `'Yeni mesaj'` yerine `'Ipchat'` başlığı kullanılır.
  - `activeConversation` değeri `useStore.getState()` üzerinden okunur (efekt bir kez kurulduğu için kapanış değeri bayatlamasın).
- `window.ipchat?.onOpenConversation?.(({ type, id }) => ...)` kaydedilir: ilgili kişi/grup adıyla `setActiveConversation({ type, id, name })` çağrılır (ad `contacts`/`groups` içinden bulunur, yoksa `id` metni).
- Temizlik işlevine `window.ipchat?.setUnread?.(0)` ve `document.title = 'Ipchat'` eklenir.

- [ ] **Step 4: `ContactList.jsx` içinde noktayı göster**

Her kişi/grup düğmesinde `unread[`user:${c.id}`] > 0` ise `contact-item` sınıfına `unread` eklenir ve ad yanına `<span className="unread-dot" />` konur. Sayı yazılmaz.

- [ ] **Step 5: `ChatWindow.jsx` içinde sohbeti okundu işaretle**

`key` değişince mesajlar yüklendikten sonra `api.markRead(activeConversation.type, activeConversation.id).then(() => markConversationRead(key))` çağrılır (hata sessizce yutulur).

- [ ] **Step 6: CSS ekle**

`web/src/style.css`: `.unread-dot` → 8px yuvarlak, `background: #ef4444`, satırın sağına hizalı (`margin-left: auto`); `.contact-item.unread` → `font-weight: 600`. Mevcut `.contact-item` düzeniyle uyumlu olmalı (uzun kullanıcı adı noktayı dışarı itmemeli: `min-width: 0` + `overflow: hidden` ad kapsayıcısında).

- [ ] **Step 7: Derlemeyi doğrula**

Run: `npm run build`
Expected: Hata olmadan `web/dist` üretilir.

Run: `npm test -w web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/state/store.js web/src/lib/api.js web/src/pages/ChatApp.jsx web/src/components/ContactList.jsx web/src/components/ChatWindow.jsx web/src/style.css
git commit -m "feat(web): okunmamis mesaj noktasi, anlik bildirim ve okundu isareti"
```

---

### Task 5: Masaüstü — okunmamış sayısı ve bildirimle sohbet açma

**Files:**
- Modify: `desktop/src/preload.cjs:3-12`
- Modify: `desktop/src/main.js:46-72` (rozet ve bildirim), `:74-76` (tepsi güncellemesi)
- Modify: `desktop/src/tray-state.js` (saf yardımcılar)
- Modify: `desktop/src/tray.js:19-59` (ikon ve ipucu)
- Test: `desktop/test/tray-state.test.js`

**Interfaces:**
- Consumes: Görev 4 → sayfa `window.ipchat.setUnread(n)` çağırır ve `notify({ title, body, open })` gönderir.
- Produces:
  - Köprü: `setUnread(count)` → `app:unread`; `onOpenConversation(cb)` → `ipchat:open-conversation`; `notify(payload)` artık `payload.open = { type, id }` taşır.
  - `tray-state.js` → `alertCount(state): number` (`state.badge + state.unread`), `tooltipLines(state): string[]`.

- [ ] **Step 1: Write the failing test**

`desktop/test/tray-state.test.js` dosyasına ekle:

```js
import { applyState, alertCount, tooltipLines } from '../src/tray-state.js';

const base = { running: false, urls: [], badge: 0, unread: 0, warning: false };

test('alertCount bekleyen hesap ve okunmamis mesaji toplar', () => {
  assert.equal(alertCount({ ...base, badge: 2, unread: 3 }), 5);
  assert.equal(alertCount(base), 0);
});

test('tooltipLines ikisini ayri satirlarda yazar', () => {
  assert.deepEqual(tooltipLines({ ...base, badge: 2, unread: 3 }), ['2 bekleyen hesap', '3 okunmamış mesaj']);
});

test('tooltipLines sunucu calisirken adresleri de ekler', () => {
  assert.deepEqual(tooltipLines({ ...base, running: true, urls: ['http://192.168.1.5:3000'] }), [
    'Ipchat sunucusu çalışıyor',
    'http://192.168.1.5:3000',
  ]);
});

test('tooltipLines sessizken bos dizi doner', () => {
  assert.deepEqual(tooltipLines(base), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w desktop -- --test-name-pattern=alertCount`
Expected: FAIL — `alertCount` dışa aktarılmamış.

- [ ] **Step 3: `alertCount(state)` ve `tooltipLines(state)` işlevlerini `desktop/src/tray-state.js` içinde yaz**

`tooltipLines` sırası: `badge > 0` → `${badge} bekleyen hesap`; `unread > 0` → `${unread} okunmamış mesaj`; `running` → `'Ipchat sunucusu çalışıyor'` ve `...urls`; `running && warning` → `'Güvenlik duvarı kurum ilkesiyle yönetiliyor'`.

- [ ] **Step 4: `tray.js` içinde bu işlevleri kullan**

`state` başlangıcına `unread: 0` eklenir. `const alert = alertCount(state) > 0;` ikon seçiminde kullanılır; macOS `tray.setTitle(alert ? String(alertCount(state)) : '')`; ipucu `tooltipLines(state)` ile kurulur (boşsa `'Ipchat'`).

- [ ] **Step 5: Köprüye `setUnread` ve `onOpenConversation` ekle**

`desktop/src/preload.cjs`:
```js
setUnread: (count) => ipcRenderer.invoke('app:unread', count),
onOpenConversation: (callback) => {
  ipcRenderer.removeAllListeners('ipchat:open-conversation');
  ipcRenderer.on('ipchat:open-conversation', (_e, payload) => callback(payload));
},
```

- [ ] **Step 6: `main.js` içinde `app:unread` işleyicisini ve bildirim hedefini yaz**

- `lastBadge` yerine iki sayaç: `let pendingCount = 0; let unreadCount = 0;` ve tek bir `refreshCounts()`: `tray?.update({ badge: pendingCount, unread: unreadCount })`, macOS dock rozeti `pendingCount + unreadCount` (0 ise boş metin); toplam değişmediyse dock'a dokunulmaz (mevcut `lastBadge` karşılaştırmasının yerini alır).
- `setBadge(count)` → `pendingCount = count; refreshCounts();` (mevcut çağrı yerleri değişmez). Yeni `setUnreadCount(count)` → `unreadCount = count; refreshCounts();`.
- `ipcMain.handle('app:unread', ...)`: `isServerSender` kontrolü, `Number.isInteger(count) && count > 0 ? Math.min(count, 99) : 0` sınırı, `setUnreadCount(...)`.
- `app:notify` işleyicisinde: `payload.open` doğrulanır (`type` `'user'`/`'group'`, `id` tamsayı). Geçerliyse tıklamada `win.webContents.send('ipchat:open-conversation', { type, id })`, değilse mevcut `ipchat:open-admin` davranışı korunur.
- `showConnectPage` ve `openServer` içindeki `setBadge(0)` çağrılarının yanına `setUnreadCount(0)` eklenir (yeni sayfa açılırken eski sayı kalmasın).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -w desktop`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop/src/preload.cjs desktop/src/main.js desktop/src/tray-state.js desktop/src/tray.js desktop/test/tray-state.test.js
git commit -m "feat(masaustu): okunmamis mesaj rozeti ve bildirimden sohbet acma"
```

---

### Task 6: İkinci sunucu koruması

**Files:**
- Create: `desktop/src/server-guard.js`
- Modify: `desktop/src/main.js:163-168,204-243,322-330,349-362`
- Modify: `desktop/src/tray.js:21-35`
- Modify: `desktop/src/connect.html:32,64-76`
- Test: `desktop/test/server-guard.test.js`

**Interfaces:**
- Consumes: `resolveServer` sonucu (`{ status: 'ok'|'choose'|'manual', url?, servers? }`)
- Produces:
  - `networkServerKnown(result): boolean` — ağda bu bilgisayardan başka bir sunucu bilindiğinde `true`.
  - `HOST_CONFIRM: { type, title, message, detail, buttons, defaultId, cancelId }` — sunucu modu onay penceresinin içeriği.

- [ ] **Step 1: Write the failing test**

`desktop/test/server-guard.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkServerKnown, HOST_CONFIRM } from '../src/server-guard.js';

test('agda bulunan sunucu listesi varsa bilinir', () => {
  assert.equal(networkServerKnown({ status: 'choose', servers: [{ url: 'http://192.168.1.5:3000' }] }), true);
});

test('uzak bir sunucuya bagliysa bilinir', () => {
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://192.168.1.5:3000' }), true);
});

test('kendi bilgisayarindaki sunucu agda baska sunucu sayilmaz', () => {
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://127.0.0.1:3000' }), false);
  assert.equal(networkServerKnown({ status: 'ok', url: 'http://localhost:3000' }), false);
});

test('sunucu bulunamadiysa bilinmez', () => {
  assert.equal(networkServerKnown({ status: 'manual' }), false);
  assert.equal(networkServerKnown({ status: 'choose', servers: [] }), false);
  assert.equal(networkServerKnown(undefined), false);
});

test('onay penceresinin varsayilani Vazgec', () => {
  assert.equal(HOST_CONFIRM.buttons[HOST_CONFIRM.defaultId], 'Vazgeç');
  assert.equal(HOST_CONFIRM.cancelId, HOST_CONFIRM.defaultId);
  assert.match(HOST_CONFIRM.message, /sunucu olacak/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w desktop -- --test-name-pattern=sunucu`
Expected: FAIL — `../src/server-guard.js` bulunamadı.

- [ ] **Step 3: `desktop/src/server-guard.js` dosyasını yaz**

`networkServerKnown`: `status === 'choose'` ise `servers` dizisi boş değilse `true`; `status === 'ok'` ise `url`'in ana makinesi `127.0.0.1`, `localhost` veya `::1` değilse `true`; diğer her durumda `false`.

`HOST_CONFIRM` içeriği (metin birebir):
```js
export const HOST_CONFIRM = {
  type: 'question',
  title: 'Ipchat',
  message: 'Bu bilgisayar sunucu olacak.',
  detail: 'Ağda başka bir sunucu varsa karışıklık olur: kullanıcılar iki ayrı sunucuya dağılır ve birbirini göremez. Devam edilsin mi?',
  buttons: ['Devam et', 'Vazgeç'],
  defaultId: 1,
  cancelId: 1,
};
```

- [ ] **Step 4: `main.js` içinde keşif sonucunu takip et ve onayı zorunlu kıl**

- Modül düzeyinde `let serverKnown = false;`. `connectToServer` ve `retryInBackground` içinde `resolveServer` sonucu alındıktan sonra `serverKnown = networkServerKnown(result); updateTray();`.
- `updateTray()` çağrısına `networkServerKnown: serverKnown` eklenir.
- Yeni işlev `requestServerMode()`: `dialog.showMessageBox(alive() ? win : undefined, HOST_CONFIRM)` sonucu `response !== 0` ise `{ cancelled: true }` döner; değilse `enableServerMode()` çağırır ve `{ ok: true }` döner, hata durumunda `{ error: ... }`.
- `ipcMain.handle('server:host', ...)` artık `requestServerMode()` sonucunu döner (mevcut hata metni korunur).
- Tepsideki `hostServer` geri çağrısı `requestServerMode().catch(() => {})` olur.

- [ ] **Step 5: `tray.js` menüsünde seçeneği gizle**

`state`'e `networkServerKnown: false` eklenir. Sunucu çalışmıyorken: `state.networkServerKnown` doğruysa `{ label: 'Ağda zaten bir sunucu var', enabled: false }`, değilse mevcut `{ label: 'Bu bilgisayarı sunucu yap', click: hostServer }`. `'Sunucuyu değiştir'` her iki durumda da kalır.

- [ ] **Step 6: `connect.html` içinde düğmeyi devre dışı bırak**

`mode === 'choose'` ve `servers` dizisi boş değilse `#host` düğmesi `disabled` yapılır, metni `Ağda zaten bir sunucu var` olur ve altına açıklama yazılır: `Yukarıdaki sunuculardan birine bağlan. İkinci bir sunucu kurarsan kullanıcılar birbirini göremez.` Devre dışı düğme için soluk bir stil eklenir (`button:disabled { opacity: .55; cursor: default; }`).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -w desktop`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop/src/server-guard.js desktop/src/main.js desktop/src/tray.js desktop/src/connect.html desktop/test/server-guard.test.js
git commit -m "feat(masaustu): agda sunucu varken ikinci sunucu kurulmasini engelle"
```

---

### Task 7: Sürüm, belgeler ve yayın hazırlığı

**Files:**
- Modify: `desktop/package.json:4` (`version`)
- Modify: `CLAUDE.md` ("Bekleyen karar" ve "Güncel durum" bölümleri)
- Modify: `docs/superpowers/specs/2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md:4` (`Durum: onaylandı ve uygulandı`)

- [ ] **Step 1: Tüm testleri çalıştır**

Run: `npm test -w server && npm test -w web && npm test -w desktop && npm run build`
Expected: Hepsi PASS, `web/dist` üretilir.

- [ ] **Step 2: Sürüm numarasını artır**

`desktop/package.json` içinde `"version": "0.2.2"` → `"0.3.0"`.

- [ ] **Step 3: `CLAUDE.md` durumunu güncelle**

"Bekleyen karar" bölümü kaldırılır. "Güncel durum" bölümüne okunmamış mesaj noktası, anlık bildirim ve ikinci sunucu korumasının tamamlandığı (0.3.0) yazılır; sıradaki işler listesinden 1. madde çıkarılır. "Bilinen tuzaklar"a bir satır eklenir: okunmamış sayımı `meta.unread_baseline_id` baseline'ına dayanır; veritabanı sıfırlanırsa baseline de sıfırlanır.

- [ ] **Step 4: Tasarım belgesinin durumunu güncelle**

`Durum: onay bekliyor` → `Durum: onaylandı ve uygulandı (0.3.0)`.

- [ ] **Step 5: Commit ve dalı it**

```bash
git add desktop/package.json CLAUDE.md docs/superpowers/specs/2026-11-14-okunmamis-mesaj-ve-sunucu-korumasi-design.md
git commit -m "chore: surum 0.3.0, belgeler guncellendi"
git push -u origin claude/funny-mccarthy-x885lo
```

- [ ] **Step 6: Bağımsız inceleme iste**

`superpowers:requesting-code-review` ile dalın tamamı için inceleme yaptır; bulguları `superpowers:receiving-code-review` ile değerlendir.

- [ ] **Step 7: Kullanıcıya gerçek ortam testi adımlarını ver**

Yayın (Release etiketi) kullanıcının isteğiyle yapılır. Kullanıcıya denetlenecek adımlar numaralı ve terminal komutu olmadan verilir: Windows ve Mac'te okunmamış noktası, uygulama kapalıyken gelen mesajın açılışta görünmesi, bildirime tıklayınca doğru sohbetin açılması, tepsi ipucu, ve ağda sunucu varken "Bu bilgisayarı sunucu yap" seçeneğinin görünmemesi.
