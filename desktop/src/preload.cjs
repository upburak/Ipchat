const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipchat', {
  submitServer: (text) => ipcRenderer.invoke('server:submit', text),
  hostServer: () => ipcRenderer.invoke('server:host'),
  notify: (payload) => ipcRenderer.invoke('app:notify', payload),
  setBadge: (count) => ipcRenderer.invoke('app:badge', count),
  onOpenAdmin: (callback) => {
    ipcRenderer.removeAllListeners('ipchat:open-admin');
    ipcRenderer.on('ipchat:open-admin', () => callback());
  },
});
