const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipchat', {
  submitServer: (text) => ipcRenderer.invoke('server:submit', text),
  hostServer: () => ipcRenderer.invoke('server:host'),
});
