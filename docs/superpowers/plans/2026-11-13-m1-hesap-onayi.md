# M1: Hesap Onayı ve Yönetici Ekranı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni hesaplar yönetici onayı olmadan sisteme girmesin; yönetici bekleyen hesapları onaylayıp reddedebilsin ve kullanıcıları kapatabilsin.

**Architecture:** `users` tablosuna `status` ve `is_admin` eklenir. Oturum doğrulaması yalnızca `active` hesapları kabul eder. Yönetici uçları `/api/admin/*` altında, `requireAdmin` ile korunur. Hesap kapatılınca/reddedilince oturum ve cihaz kayıtları silinir, açık socket bağlantıları kesilir. Web'de yöneticiye özel bir "Hesaplar" paneli eklenir.

**Tech Stack:** Node.js (>=22.5, `node:sqlite`, yerleşik `node:test`), Express, Socket.IO, React + zustand.

**Spec:** `docs/superpowers/specs/2026-11-13-ipchat-dosya-paylasimi-design.md` (bölüm 7.1 ve 8). Bu plan yalnızca M1'i kapsar; M2 (Electron kabuğu + keşif) ve M3 (ajan + paylaşım + kayıtlar) ayrı planlarla yazılacak.

## Global Constraints

- Hesap durumları tam olarak: `active`, `pending`, `rejected`, `kapatildi` değil; kodda `disabled` (arayüzde "kapatıldı").
- İlk açılan hesap otomatik yönetici ve `active` olur; sonrakiler `pending` olur ve giriş yapamaz.
- Mevcut Faz 1 hesapları `active` sayılır; hiç yönetici yoksa en eski hesap (en küçük `id`) yönetici yapılır.
- Onaylanan kişi önce şifresiyle girer, sonra mevcut akıştaki gibi 4 haneli PIN belirler (PIN akışı değişmez).
- Reddedilen kişi yeniden kayıt olabilir; kapatılan hesap yönetici tarafından yeniden açılabilir; birden fazla yönetici olabilir.
- Tek yönetici şifresini kaybederse sunucu PC'sinde çalışan bir kurtarma komutu şifreyi sıfırlar.
- Arayüz metinleri Türkçe. Testler `node --test` ile çalışır, yeni bağımlılık eklenmez.

## Review Focus

- Kayıt sırasında iki istek aynı anda "ilk hesap" olmaya çalışırsa yalnızca biri yönetici olmalı.
- Kapatılan/reddedilen kullanıcının açık socket bağlantısı ve geçerli Bearer belirteci anında geçersiz olmalı.
- Yönetici kendi hesabını kapatamamalı; son aktif yönetici kapatılamamalı veya yöneticiliği alınamamalı.
- `pending` kullanıcı kişi listesinde (`/api/users`) ve grup üyesi seçiminde görünmemeli.
- Olmayan `id` ile onay/red isteği 404 dönmeli, yönetici olmayan 403 almalı.

---

### Task 1: Veritabanı geçişi ve test altyapısı

**Files:**
- Modify: `server/src/db.js` (yol `process.env.IPCHAT_DB_PATH` ile değiştirilebilir, `:memory:` desteklenir; geçiş eklenir)
- Modify: `server/package.json` (`"test": "node --test"`)
- Test: `server/test/db-migration.test.js`

**Interfaces:**
- Produces: `users.status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected','disabled'))`, `users.is_admin INTEGER NOT NULL DEFAULT 0`; `export function migrate(db): void` (idempotent).

- [ ] **Step 1: Başarısız test yaz** — `migrates legacy users to active and promotes oldest to admin`: eski şemayla (status/is_admin yok) 3 kullanıcı oluştur, `migrate` çalıştır, `status === 'active'` ve yalnızca en küçük `id`'nin `is_admin === 1` olduğunu doğrula. İkinci test: `migrate` iki kez çalışınca hata vermez ve yönetici değişmez.
- [ ] **Step 2: Çalıştır, FAIL gör:** `npm test -w server`
- [ ] **Step 3: `migrate(db)` uygula:** `PRAGMA table_info(users)` ile sütun yoksa `ALTER TABLE ADD COLUMN`; hiç `is_admin=1` yoksa en küçük `id`'yi yönetici yap. `db.js` bunu açılışta çağırır.
- [ ] **Step 4: PASS gör**, **Step 5: Commit** (`feat: hesap durumu ve yonetici sutunlari`)

### Task 2: Kayıt, giriş ve oturum doğrulaması

**Files:**
- Modify: `server/src/auth.js`, `server/src/routes/auth.js`
- Test: `server/test/auth.test.js`

**Interfaces:**
- Consumes: `users.status`, `users.is_admin` (Task 1).
- Produces: `register(username, password): { userId, username, status, token? }` (ilk hesapta `token` ve `status:'active'`; sonrakilerde `token` yok, `status:'pending'`); `login`/`loginWithPin` `pending|rejected|disabled` için sırasıyla `'Hesabın yönetici onayı bekliyor'`, `'Hesabın reddedildi'`, `'Hesabın kapatıldı'` hatası fırlatır; `verifySession(token): { id, username, isAdmin } | null` yalnızca `active` için döner. Kayıt ve ilk-yönetici kararı tek `BEGIN IMMEDIATE` işleminde verilir.

- [ ] **Step 1: Testler:** `first registered user is active admin with token`; `second registered user is pending with no token`; `pending user cannot log in (password and pin)`; `verifySession returns null for non-active`; `rejected user can register again with same username` (eski `rejected` kaydı yeniden `pending` yapılır).
- [ ] **Step 2: FAIL gör**, **Step 3: Uygula** (yukarıdaki imzalarla), `routes/auth.js` `/register` yanıtında `status` döndürsün, `/me` `isAdmin` içersin. **Step 4: PASS**, **Step 5: Commit**.

### Task 3: Yönetici servisi, uçlar ve kapatma etkisi

**Files:**
- Create: `server/src/admin.js`, `server/src/routes/admin.js`
- Modify: `server/src/index.js` (router'ı bağla, `io`'yu admin servisine ver), `server/src/routes/messages.js` (`/users` yalnızca `status='active'`)
- Test: `server/test/admin.test.js`

**Interfaces:**
- Consumes: `verifySession` (Task 2).
- Produces: `requireAdmin` ara katmanı (403 yönetici değilse); `GET /api/admin/users` → `[{id, username, status, isAdmin, createdAt}]`; `POST /api/admin/users/:id/{approve|reject|disable|enable|promote|demote}`; `revokeUser(userId, io)` oturum ve cihazları siler, `io.in('user:'+id).disconnectSockets(true)` çağırır.

- [ ] **Step 1: Testler:** `non-admin gets 403`; `approve moves pending to active`; `disable deletes sessions and devices`; `unknown id returns 404`; `admin cannot disable self`; `cannot demote or disable the last active admin`; `/users excludes pending`.
- [ ] **Step 2: FAIL**, **Step 3: Uygula** (durum geçişlerini `admin.js`'te tek fonksiyonda topla), **Step 4: PASS**, **Step 5: Commit**.

### Task 4: Yönetici şifre kurtarma komutu

**Files:**
- Create: `server/scripts/reset-admin.js`
- Modify: `package.json` (`"reset-admin": "node server/scripts/reset-admin.js"`)
- Test: `server/test/reset-admin.test.js`

**Interfaces:**
- Produces: `resetAdmin(db, username, newPassword): void` (kullanıcıyı `active` + yönetici yapar, şifreyi sıfırlar, oturum ve cihazlarını siler). CLI: `npm run reset-admin -- <kullanici> <yeni-sifre>`.

- [ ] **Step 1: Test:** `resetAdmin makes user an active admin with new password and clears sessions`; bilinmeyen kullanıcı hata verir. **Step 2–5:** FAIL → uygula → PASS → Commit.

### Task 5: Web: kayıt/giriş akışı ve yönetici paneli

**Files:**
- Modify: `web/src/lib/api.js` (`adminListUsers`, `adminAction(id, action)`), `web/src/state/store.js` (`currentUser.isAdmin`), `web/src/pages/LoginScreen.jsx` (kayıt `pending` dönerse "Hesabın yönetici onayı bekliyor" ekranı), `web/src/pages/ChatApp.jsx` (yönetici için "Hesaplar" düğmesi)
- Create: `web/src/components/AdminPanel.jsx`

**Interfaces:**
- Consumes: Task 3 uçları. `AdminPanel` bekleyenleri üstte, diğer hesapları altta listeler; her satırda duruma uygun düğmeler (Onayla/Reddet, Kapat/Aç, Yönetici yap/al). Hata metni satır içinde gösterilir.

- [ ] **Step 1:** Kod yaz, `npm run build` hatasız geçsin. **Step 2 (doğrulama):** Sunucuyu temiz veritabanıyla başlat; birinci hesap girişte yönetici olsun, ikinci kayıt "onay bekliyor" görsün ve giriş yapamasın; yönetici panelden onaylasın, ikinci hesap girebilsin; yönetici kapatınca ikinci hesabın açık oturumu düşsün. **Step 3: Commit.**
- [ ] **Son:** `README.md`'ye "Hesap onayı ve yönetici" bölümü ekle (ilk hesap yönetici, kurtarma komutu), commit.
