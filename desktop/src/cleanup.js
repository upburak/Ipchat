// Temiz kaldırma: karar mantığı ve metinler. Electron'a bağımlı değildir;
// main.js ve kurulum betiği bu dosyadan karar ve metin alır.

export const INSTALL_NOTICE = {
  message: 'Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz.',
  detail:
    'Program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir.\n\n' +
    'Bu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur.',
};

const CLIENT_CONFIRM = {
  message: 'Ipchat ve bu bilgisayardaki tüm verisi siliniyor.',
  detail: 'Bu işlem geri alınamaz.',
};

function serverConfirm(serverDataPath) {
  return {
    message: 'Bu bilgisayar Ipchat sunucusuydu.',
    detail:
      'Kullanıcıların hesapları ve mesaj geçmişi silinmedi, şurada duruyor:\n' +
      `${serverDataPath}\n\n` +
      'Bunları da silmek istersen bu klasörü elle sil.',
  };
}

// Mac tepsi onayı. Yıkıcı işlem olduğu için pencere kalır; varsayılan ve iptal Vazgeç.
export function uninstallConfirm(hasServerData, serverDataPath) {
  const text = hasServerData ? serverConfirm(serverDataPath) : CLIENT_CONFIRM;
  return {
    message: text.message,
    detail: text.detail,
    buttons: ['Kaldır', 'Vazgeç'],
    defaultId: 1,
    cancelId: 1,
  };
}

// Kabuk betiği argümanları. Yol metne gömülmez; "$1" olarak geçirilir (boşluklu Mac yolu için).
// Dosyaları uygulama kapanana kadar 2 sn bekleyerek siler. Gizli dosyalar da silinir.
export function purgeArgs(userDataDir, keepServerData) {
  const script = keepServerData
    ? 'sleep 2; find "$1" -mindepth 1 -maxdepth 1 ! -name server-data -exec rm -rf {} +'
    : 'sleep 2; rm -rf "$1"';
  return ['-c', script, 'ipchat-purge', userDataDir];
}

export function shouldShowInstallNotice(config) {
  return !config?.installNoticeShown;
}

// NSIS'in IfFileExists "…\server-data\*.*" davranışı: boş klasör sunucu sayılmaz.
export function hasServerData(entries) {
  return Array.isArray(entries) && entries.length > 0;
}
