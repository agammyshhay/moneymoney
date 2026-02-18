import { app, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import { restoreOrCreateWindow, setIsQuitting } from '/@/mainWindow';

let tray: Tray | null = null;
let hasShownBalloon = false;

export function hasTray(): boolean {
  return tray !== null;
}

export function showMinimizedToTrayBalloon() {
  if (!hasShownBalloon && tray) {
    tray.displayBalloon({
      title: 'MoneyMoney',
      content: 'האפליקציה ממשיכה לרוץ ברקע. לחץ על האייקון כדי לפתוח.',
    });
    hasShownBalloon = true;
  }
}

export function initTray() {
  if (tray) {
    return;
  }

  const iconPath = import.meta.env.PROD
    ? path.join(process.resourcesPath, 'tray-icon.ico')
    : path.join(app.getAppPath(), 'packages/renderer/src/assets/logos/piggyLogo.ico');

  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('MoneyMoney');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'פתח את MoneyMoney',
      click: () => restoreOrCreateWindow(true),
    },
    {
      label: 'יציאה',
      click: () => {
        setIsQuitting(true);
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    restoreOrCreateWindow(true);
  });
}
