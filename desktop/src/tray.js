import { Tray, Menu, nativeImage, clipboard } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const image = (name) =>
  nativeImage.createFromPath(path.join(here, '..', 'assets', name)).resize({ width: 18, height: 18 });

import { applyState, alertCount, tooltipLines } from './tray-state.js';

export function createTray({ showWindow, changeServer, uninstall, hostServer, stopHosting, quit, isAutoStart, setAutoStart }) {
  const normalIcon = image('icon.png');
  const serverIcon = image('icon-server.png');
  const alertIcon = image('icon-alert.png');
  const serverAlertIcon = image('icon-server-alert.png');
  const tray = new Tray(normalIcon);
  tray.setToolTip('Ipchat');

  const state = { running: false, urls: [], badge: 0, unread: 0, warning: false };

  const rebuild = () => {
    const items = [{ label: 'Aç', click: showWindow }, { type: 'separator' }];
    if (state.running) {
      items.push({ label: 'Sunucu: Çalışıyor', enabled: false });
      for (const url of state.urls) {
        items.push({ label: `Adres: ${url}`, click: () => clipboard.writeText(url) });
      }
      if (state.warning) {
        items.push({ label: 'Uyarı: güvenlik duvarı kurum ilkesiyle yönetiliyor', enabled: false });
      }
      items.push({ label: 'Sunucu modunu kapat', click: stopHosting });
    } else {
      items.push({ label: 'Bu bilgisayarı sunucu yap', click: hostServer });
      items.push({ label: 'Sunucuyu değiştir', click: changeServer });
    }
    items.push(
      { type: 'separator' },
      {
        label: 'Bilgisayar açılınca başlat',
        type: 'checkbox',
        checked: isAutoStart(),
        click: (item) => {
          setAutoStart(item.checked);
          rebuild();
        },
      },
      { label: process.platform === 'win32' ? 'Ipchat\'i kaldır…' : 'Ipchat\'i tamamen kaldır…', click: uninstall },
      { label: 'Çık', click: quit }
    );
    tray.setContextMenu(Menu.buildFromTemplate(items));
    const alert = alertCount(state) > 0;
    tray.setImage(state.running ? (alert ? serverAlertIcon : serverIcon) : alert ? alertIcon : normalIcon);
    if (process.platform === 'darwin') tray.setTitle(alert ? String(alertCount(state)) : '');
    const lines = tooltipLines(state);
    tray.setToolTip(lines.length ? lines.join('\n') : 'Ipchat');
  };

  rebuild();
  tray.on('click', showWindow);
  return {
    update(next) {
      if (applyState(state, next)) rebuild();
    },
  };
}
