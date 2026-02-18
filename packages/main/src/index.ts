import { app } from 'electron';
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

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => restoreOrCreateWindow(true));

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
