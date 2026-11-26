// İlk açılış onayı: karar mantığı. Electron'a bağımlı değildir; main.js bu dosyadan karar alır.
// Metin içerik olarak değişirse WELCOME_VERSION artırılır ve herkes yeniden onaylar
// (yazım düzeltmesi için artırılmaz). Bkz. docs/superpowers/specs/2026-11-26-ilk-acilis-onayi-design.md §7.3.
export const WELCOME_VERSION = 1;

// Ekran gösterilmeli mi? Geliştirme modunda (paketli değil) hiç gösterilmez.
// Bozuk ya da beklenmedik bir ayar dosyası asla onay sayılmaz: yalnızca sayı olan
// ve güncel sürüme eşit ya da ondan büyük bir sürüm kaydı onaydır.
export function needsWelcome(config, isPackaged) {
  if (!isPackaged) return false;
  const version = config?.welcomeAccepted?.version;
  const accepted = typeof version === 'number' && version >= WELCOME_VERSION;
  return !accepted;
}

// Ayar dosyasına yazılacak onay kaydı.
export function welcomeRecord(now) {
  return { version: WELCOME_VERSION, at: now.toISOString() };
}
