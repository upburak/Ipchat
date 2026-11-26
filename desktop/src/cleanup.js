// Temiz kaldırma: karar mantığı ve metinler. Electron'a bağımlı değildir;
// main.js ve kurulum betiği bu dosyadan karar ve metin alır.
import path from 'node:path';

// İlk açılış ekranındaki kaldırma kuralı; metin platforma göre değişir (tasarım §7.1, §7.4.1).
// Mac'teki eski ayrı ilk açılış bildirimi (INSTALL_NOTICE) bu ekranla birleşti.
// Sunucu cümlesi ikisinde de aynıdır. Windows dışındaki bilinmeyen değerler Windows metnini alır.
const SERVER_KEPT_SENTENCE =
  'Bu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur.';

export function removalRule(platform) {
  if (platform === 'darwin') {
    return (
      'Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz: program, ayarlar ve otomatik başlatma kaydı silinir. ' +
      'Kaldırmak için tepsi menüsünden "Ipchat\'i tamamen kaldır…" seçeneğini kullan; uygulamayı yalnızca Çöp Kutusu\'na atmak veriyi geride bırakır. ' +
      SERVER_KEPT_SENTENCE
    );
  }
  return (
    'Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz: program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir. ' +
    SERVER_KEPT_SENTENCE
  );
}

const CLIENT_CONFIRM = {
  message: 'Ipchat ve bu bilgisayardaki tüm verisi silinecek.',
  detail: 'Bu işlem geri alınamaz.',
};

// Onay penceresi silmeden önce açılır: gelecek zaman kullanılır.
function serverConfirm(serverDataPath) {
  return {
    message: 'Bu bilgisayar bir Ipchat sunucusu.',
    detail:
      "Uygulama Çöp Kutusu'na taşınır, ayarlar ve otomatik başlatma silinir.\n\n" +
      'Kullanıcıların hesapları ve mesaj geçmişi korunacak, silinmeyecek. Şurada duruyor:\n' +
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
// Önce uygulamanın kapanmasını bekler (varsayılan 2 sn), sonra siler. Gizli dosyalar da silinir.
// "--" yol "-" ile başlasa bile bir seçenek sayılmasını önler.
export function purgeArgs(userDataDir, keepServerData, delaySeconds = 2) {
  const wait = `sleep ${delaySeconds}`;
  const script = keepServerData
    ? `${wait}; find -- "$1" -mindepth 1 -maxdepth 1 ! -name server-data -exec rm -rf {} +`
    : `${wait}; rm -rf -- "$1"`;
  return ['-c', script, 'ipchat-purge', userDataDir];
}

// Kural: yalnızca server-data'nın olmadığından eminsek istemci sayılır (ENOENT).
// Okuma başka bir hatayla başarısız olduysa emin olamayız: sunucu say, koru (tasarım §9).
// Dizin boşsa da sunucu sayılır: NSIS belgelerine göre IfFileExists "dizin\*.*" boş dizinde de
// eşleşir, yani Windows böyle davranır (gerçek Windows'ta denenmedi).
export function hasServerData(entries, errorCode) {
  return errorCode !== 'ENOENT';
}

// Önceki kaldırma server-data'yı geçici klasörde bıraktıysa (yalnızca Windows kaldırıcısı üretir)
// açılışta yöneticiyi uyarmak için. Uygulama bu klasöre asla dokunmaz, silmez.
export function leftoverServerDataNotice(userDataDir, tmpExists) {
  if (!tmpExists) return null;
  const tmpPath = path.join(path.dirname(userDataDir), 'ipchat-server-data-tmp');
  const target = path.join(userDataDir, 'server-data');
  return {
    tmpPath,
    message: 'Önceki kaldırmadan kalan hesaplar ve mesajlar bulundu.',
    detail:
      'Kullanıcıların hesapları ve mesaj geçmişi silinmedi, şu klasörde duruyor:\n' +
      `${tmpPath}\n\n` +
      'Geri almak için Ipchat\'i kapat ve bu klasörü şu adla ve yere taşı (orada yeni, boş bir server-data varsa önce onu sil):\n' +
      `${target}\n\n` +
      'Ipchat bu klasörü kendiliğinden silmez; taşıyana kadar yedek olarak durur.',
  };
}
