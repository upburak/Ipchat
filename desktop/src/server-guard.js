const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

// Ağda, bu bilgisayardan başka bir sunucu biliniyor mu?
export function networkServerKnown(result) {
  if (!result) return false;
  if (result.status === 'choose') return Array.isArray(result.servers) && result.servers.length > 0;
  // 'changed': kimliği değişmiş de olsa ağdaki bir sunucudur (adres döngü-geri değilse).
  if (result.status === 'ok' || result.status === 'changed') {
    try {
      return !LOOPBACK_HOSTS.has(new URL(result.url).hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export const HOST_CONFIRM = {
  type: 'question',
  title: 'Ipchat',
  message: 'Bu bilgisayar sunucu olacak.',
  detail: 'Ağda başka bir sunucu varsa karışıklık olur: kullanıcılar iki ayrı sunucuya dağılır ve birbirini göremez. Devam edilsin mi?',
  buttons: ['Devam et', 'Vazgeç'],
  defaultId: 1,
  cancelId: 1,
};

export const CHANGE_SERVER_CONFIRM = {
  type: 'question',
  title: 'Ipchat',
  message: 'Şu anki sunucuyla bağlantın kesilecek.',
  detail: 'Başka bir Ipchat sunucusuna bağlanmak için yeniden arama ekranı açılır. Devam edilsin mi?',
  buttons: ['Devam et', 'Vazgeç'],
  defaultId: 1,
  cancelId: 1,
};
