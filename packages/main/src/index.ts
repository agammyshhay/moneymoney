import { app, BrowserWindow } from 'electron';
import { platform } from 'node:process';
import { registerHandlers } from './handlers';
import './security-restrictions';
import { restoreOrCreateWindow, setIsQuitting } from '/@/mainWindow';
import { initTray } from './tray';
// [CUSTOM-STARTUP-START]
import { getConfig } from '@/backend/configManager/configManager';
import { migrateOldConfig } from '@/backend/configManager/migration';
// [CUSTOM-STARTUP-END]
// [CUSTOM-UPDATE-START]
import { initAutoUpdate } from './handlers/updater';
// [CUSTOM-UPDATE-END]
// [CUSTOM-BASE44-START]
import { saveBase44Token } from '@/backend/auth/base44Token';
import logger from '/@/logging/logger';
// [CUSTOM-BASE44-END]

// [CUSTOM-BASE44-START]
// Deep link: pending URL received before the window is ready
let pendingDeepLinkUrl: string | null = null;

async function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'auth') {
      const token = parsed.searchParams.get('token');
      if (token) {
        await saveBase44Token(token);
        logger.info('Bearer token received via deep link');
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.webContents.send('base44-token-received');
        }
      }
    }
  } catch (e) {
    logger.error('Failed to handle deep link', e);
  }
}

// Handle deep link on cold start (app launched via moneymoney:// URL while not running)
const deepLinkArg = process.argv.find((arg) => arg.startsWith('moneymoney://'));
if (deepLinkArg) {
  pendingDeepLinkUrl = deepLinkArg;
}
// [CUSTOM-BASE44-END]

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

// [CUSTOM-BASE44-START]
// Register protocol handler for moneymoney:// deep links AFTER the single-instance
// lock, so a second instance (launched from a deep link with CWD=system32) never
// overwrites the registry with a wrong path.
if (import.meta.env.DEV) {
  app.setAsDefaultProtocolClient('moneymoney', process.execPath, [app.getAppPath()]);
} else {
  app.setAsDefaultProtocolClient('moneymoney');
}
// [CUSTOM-BASE44-END]
app.on('second-instance', (_event, argv) => {
  // [CUSTOM-BASE44-START]
  const deepLinkUrl = argv.find((arg) => arg.startsWith('moneymoney://'));
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
  }
  // [CUSTOM-BASE44-END]
  restoreOrCreateWindow(true);
});

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

app.on('before-quit', () => setIsQuitting(true));

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', () => restoreOrCreateWindow(true));

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(() => {
    console.log('App ready');
    try {
      migrateOldConfig();
      console.log('Migration done');
    } catch (e) {
      console.error('Migration failed', e);
    }

    try {
      initTray();
      console.log('Tray initialized');
    } catch (e) {
      console.error('Tray failed', e);
    }

    const isHidden = process.argv.includes('--hidden');
    console.log('Restoring window, hidden:', isHidden);
    return restoreOrCreateWindow(!isHidden);
  })
  // [CUSTOM-BASE44-START]
  .then(async () => {
    // Process deep link that arrived during cold start
    if (pendingDeepLinkUrl) {
      await handleDeepLink(pendingDeepLinkUrl);
      pendingDeepLinkUrl = null;
    }
  })
  // [CUSTOM-BASE44-END]
  .then(async () => {
    // [CUSTOM-STARTUP-START]
    // Set the app to open at login (Windows only)
    if (platform === 'win32' && import.meta.env.PROD) {
      const config = await getConfig();
      const runAtStartup = config.runAtStartup ?? true;
      const appFolder = app.getPath('exe');
      app.setLoginItemSettings({
        openAtLogin: runAtStartup,
        path: appFolder,
        args: ['--hidden'],
      });
    }
    // [CUSTOM-STARTUP-END]
  })
  .catch((e) => console.error('Failed create window:', e));

/**
 * Install Vue.js or any other extension in development mode only.
 * Note: You must install `electron-devtools-installer` manually
 */
// if (import.meta.env.DEV) {
//   app
//     .whenReady()
//     .then(() => import('electron-devtools-installer'))
//     .then(module => {
//       const {default: installExtension, REACT_DEVELOPER_TOOLS} =
//         //@ts-expect-error Hotfix for https://github.com/cawa-93/vite-electron-builder/issues/915
//         typeof module.default === 'function' ? module : (module.default as typeof module);
//
//       return installExtension(REACT_DEVELOPER_TOOLS, {
//         loadExtensionOptions: {
//           allowFileAccess: true,
//         },
//       });
//     })
//     .catch(e => console.error('Failed install extension:', e));
// }

// [CUSTOM-UPDATE-START]
// Auto-update: check once on startup, download in background, notify renderer
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => initAutoUpdate())
    .catch((e) => console.error('Failed to init auto-update:', e));
}
// [CUSTOM-UPDATE-END]

registerHandlers();
