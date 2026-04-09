import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '@/backend/configManager/configManager';
import { hasTray, showMinimizedToTrayBalloon } from './tray';

export let isQuitting = false;

export function setIsQuitting(value: boolean) {
  isQuitting = value;
}

async function createWindow() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Edit',
        submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
      },
    ]),
  );

  const browserWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(app.getAppPath(), 'packages/preload/dist/index.mjs'),
    },
  });

  /**
   * If the 'show' property of the BrowserWindow's constructor is omitted from the initialization options,
   * it then defaults to 'true'. This can cause flickering as the window loads the html content,
   * and it also has show problematic behaviour with the closing of the window.
   * Use `show: false` and listen to the  `ready-to-show` event to show the window.
   *
   * @see https://github.com/electron/electron/issues/25012 for the afford mentioned issue.
   */
  browserWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    if (!process.argv.includes('--hidden')) {
      console.log('Showing window');
      browserWindow?.show();
    }

    // [CUSTOM-BASE44-START] Add desktop badge overlay on taskbar icon (Windows)
    if (process.platform === 'win32') {
      const overlaySize = 16;
      const canvas = Buffer.alloc(overlaySize * overlaySize * 4);
      // Draw a simple blue filled circle as "desktop" badge indicator
      const cx = overlaySize / 2;
      const cy = overlaySize / 2;
      const r = overlaySize / 2 - 1;
      for (let y = 0; y < overlaySize; y++) {
        for (let x = 0; x < overlaySize; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= r * r) {
            const idx = (y * overlaySize + x) * 4;
            // Blue color (#1a73e8) in BGRA format
            canvas[idx] = 0xe8; // B
            canvas[idx + 1] = 0x73; // G
            canvas[idx + 2] = 0x1a; // R
            canvas[idx + 3] = 0xff; // A
          }
        }
      }
      const overlay = nativeImage.createFromBuffer(canvas, { width: overlaySize, height: overlaySize });
      browserWindow.setOverlayIcon(overlay, 'Desktop App');
    }
    // [CUSTOM-BASE44-END]

    if (import.meta.env.DEV) {
      browserWindow?.webContents.openDevTools();
    }
  });

  browserWindow.on('close', (event) => {
    if (isQuitting) return;

    // Must call preventDefault synchronously — Electron does not wait for async handlers
    event.preventDefault();

    getConfig()
      .then((config) => {
        if ((config.minimizeToTray ?? true) && hasTray()) {
          browserWindow.hide();
          showMinimizedToTrayBalloon();
        } else {
          setIsQuitting(true);
          browserWindow.destroy();
        }
      })
      .catch(() => {
        // Config read failed — default to minimize-to-tray if tray exists
        if (hasTray()) {
          browserWindow.hide();
          showMinimizedToTrayBalloon();
        } else {
          setIsQuitting(true);
          browserWindow.destroy();
        }
      });
  });

  /**
   * Load the main page of the main window.
   */
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    /**
     * Load from the Vite dev server for development.
     */
    await browserWindow.loadURL(import.meta.env.VITE_DEV_SERVER_URL);
    console.log('Loaded URL:', import.meta.env.VITE_DEV_SERVER_URL);
  } else {
    /**
     * Load from the local file system for production and test.
     *
     * Use BrowserWindow.loadFile() instead of BrowserWindow.loadURL() for WhatWG URL API limitations
     * when path contains special characters like `#`.
     * Let electron handle the path quirks.
     * @see https://github.com/nodejs/node/issues/12682
     * @see https://github.com/electron/electron/issues/6869
     */
    await browserWindow.loadFile(fileURLToPath(new URL('./../../renderer/dist/index.html', import.meta.url)));
  }

  return browserWindow;
}

/**
 * Restore an existing BrowserWindow or Create a new BrowserWindow.
 */
export async function restoreOrCreateWindow(show = true) {
  let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (show) {
    if (window.isMinimized()) {
      window.restore();
    }

    if (!window.isVisible()) {
      window.show();
    }

    window.focus();
  }
}
