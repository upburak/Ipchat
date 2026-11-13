import { Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createTray({ showWindow, changeServer, quit, isAutoStart, setAutoStart }) {
  const icon = nativeImage
    .createFromPath(path.join(here, '..', 'assets', 'icon.png'))
    .resize({ width: 18, height: 18 });
  const tray = new Tray(icon);
  tray.setToolTip('Ipchat');

  const rebuild = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Aç', click: showWindow },
        {
          label: 'Bilgisayar açılınca başlat',
          type: 'checkbox',
          checked: isAutoStart(),
          click: (item) => {
            setAutoStart(item.checked);
            rebuild();
          },
        },
        { label: 'Sunucuyu değiştir', click: changeServer },
        { type: 'separator' },
        { label: 'Çık', click: quit },
      ])
    );
  rebuild();
  tray.on('click', showWindow);
  return tray;
}
