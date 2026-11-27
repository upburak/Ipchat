export function windowOptions() {
  return {
    width: 800,
    height: 620,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'Ipchat',
    show: false,
    // Web --bg ile aynı (test eşitliği denetler): pencere ilk karede beyaz parlamasın.
    backgroundColor: '#0a1018',
  };
}

export function webPreferences(preloadPath) {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    backgroundThrottling: false,
  };
}
