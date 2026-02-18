import { BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import logger from '../logging/logger';

const { autoUpdater } = electronUpdater;

export interface UpdateInfo {
  version: string;
}

autoUpdater.logger = logger;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// [CUSTOM-UPDATE-START]
// Track last update status so renderer can query on mount
let lastUpdateStatus: { status: string; version?: string } | null = null;

function sendUpdateStatus(status: string, version?: string) {
  lastUpdateStatus = { status, version };
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (win) {
    win.webContents.send('updateStatus', JSON.stringify({ status, version }));
  }
}

export function getUpdateStatus() {
  return lastUpdateStatus;
}

export function initAutoUpdate() {
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info(`Update available: ${info.version}`);
    sendUpdateStatus('downloading', info.version);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info(`Update downloaded: ${info.version}`);
    sendUpdateStatus('downloaded', info.version);
  });

  autoUpdater.on('error', (error: Error) => {
    logger.error('Auto-update error:', error.message);
    sendUpdateStatus('error');
  });

  autoUpdater.checkForUpdates().catch((e: Error) => {
    logger.error('Failed to check for updates:', e.message);
  });
}
// [CUSTOM-UPDATE-END]

export const checkForUpdate = async () =>
  new Promise<UpdateInfo | false>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Update check timed out'));
    }, 15_000);

    const cleanup = () => {
      clearTimeout(timeout);
      autoUpdater.removeListener('error', onError);
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onAvailable = (info: UpdateInfo) => {
      cleanup();
      resolve(info);
    };
    const onNotAvailable = () => {
      cleanup();
      resolve(false);
    };
    autoUpdater.once('error', onError);
    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.checkForUpdates().catch(onError);
  });

export const downloadUpdate = async () =>
  new Promise<electronUpdater.UpdateDownloadedEvent>((resolve, reject) => {
    autoUpdater.once('error', reject);
    autoUpdater.once('update-downloaded', resolve);
    autoUpdater.downloadUpdate();
  });

export const quitAndInstall = () => {
  logger.info('Quitting and installing update');
  setImmediate(() => autoUpdater.quitAndInstall());
};
