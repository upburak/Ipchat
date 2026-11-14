const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

// Ağda, bu bilgisayardan başka bir sunucu biliniyor mu?
export function networkServerKnown(result) {
  if (!result) return false;
  if (result.status === 'choose') return Array.isArray(result.servers) && result.servers.length > 0;
  if (result.status === 'ok') {
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
