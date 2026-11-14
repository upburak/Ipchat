const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipchat', {
  submitServer: (text) => ipcRenderer.invoke('server:submit', text),
  hostServer: () => ipcRenderer.invoke('server:host'),
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
