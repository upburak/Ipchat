const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipchat', {
  submitServer: (text) => ipcRenderer.invoke('server:submit', text),
  confirmServer: (url, fingerprint) => ipcRenderer.invoke('server:confirm', url, fingerprint),
  hostServer: () => ipcRenderer.invoke('server:host'),
  // "Sunucu bulundu" ekranında "Başka bir adres yaz" (yalnızca connect.html; ana süreç göndericiyi denetler).
  dismissFound: (url) => ipcRenderer.invoke('server:found-dismiss', url),
  // İlk açılış onayı (yalnızca welcome.html kullanabilir; ana süreç göndericiyi denetler).
  getWelcomeText: () => ipcRenderer.invoke('welcome:text'),
  acceptWelcome: () => ipcRenderer.invoke('welcome:accept'),
  quitApp: () => ipcRenderer.invoke('welcome:quit'),
  notify: (payload) => ipcRenderer.invoke('app:notify', payload),
  setBadge: (count) => ipcRenderer.invoke('app:badge', count),
  setUnread: (count) => ipcRenderer.invoke('app:unread', count),
  onOpenConversation: (callback) => {
    const listener = (_e, payload) => callback(payload);
    ipcRenderer.on('ipchat:open-conversation', listener);
    return () => ipcRenderer.removeListener('ipchat:open-conversation', listener);
  },
  onOpenAdmin: (callback) => {
    ipcRenderer.removeAllListeners('ipchat:open-admin');
    ipcRenderer.on('ipchat:open-admin', () => callback());
  },
});
