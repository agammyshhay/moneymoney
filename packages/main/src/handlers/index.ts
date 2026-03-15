import { App, userDataPath } from '@/app-globals';
import {
  cancelScraping,
  scrapeAndUpdateOutputVendors,
  setPeriodicScrapingIfNeeded,
  stopPeriodicScraping,
} from '@/backend';
import { type Config, type Credentials } from '@/backend/commonTypes';
import { getConfig } from '@/backend/configManager/configManager';
import { BudgetTrackingEventEmitter } from '@/backend/eventEmitters/EventEmitter';
import electronGoogleOAuth2Connector from '@/backend/export/outputVendors/googleSheets/electronGoogleOAuth2Connector';
import { createClient, validateToken } from '@/backend/export/outputVendors/googleSheets/googleAuth';
import { createSpreadsheet } from '@/backend/export/outputVendors/googleSheets/googleSheets';
import { getAllSpreadsheets } from '@/backend/export/outputVendors/googleSheets/googleSheetsInternalAPI';
import { getYnabAccountData } from '@/manual/setupHelpers';
import { sendTransactionsToBase44, syncExistingJsonToBase44 } from '@/backend/export/outputVendors/json/json';
import { dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { discord, repository } from '../../../../package.json';
import os from 'os';
import { getConfigHandler, updateConfigHandler } from './configHandlers';
import { BASE44_DEFAULT_CONFIG } from '@/config/base44';
import { getLogsInfoHandler } from './logsHandlers';
import { checkForUpdate, downloadUpdate, getUpdateStatus, quitAndInstall } from './updater';

type Listener<T = unknown> = (
  event: IpcMainInvokeEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Promise<T> | T;

const functions: Record<string, Listener> = {
  showSaveDialog: async () => {
    const dir = await dialog.showSaveDialog({});
    return dir.filePath;
  },
  checkForUpdate,
  downloadUpdate,
  quitAndInstall,
  getUpdateStatus,
  getConfig: getConfigHandler,
  updateConfig: updateConfigHandler as Listener<void>,
  getYnabAccountData,
  getLogsInfo: getLogsInfoHandler,
  stopPeriodicScraping,
  cancelScrape: () => cancelScraping(),
  getDataFolder: () => userDataPath,
  getAppInfo: async () => {
    return {
      sourceCommitShort: import.meta.env.VITE_SOURCE_COMMIT_SHORT,
      repository,
      discordChanel: discord,
      currentVersion: App.getVersion(),
      osPlatform: process.platform,
      osArch: process.arch,
      osRelease: os.release(),
    };
  },
  // Google Sheets
  getAllUserSpreadsheets: (_: unknown, credentials: Credentials) => getAllSpreadsheets(createClient(credentials)),
  validateToken: (_: unknown, credentials: Credentials) => validateToken(credentials),
  electronGoogleOAuth2Connector,
  createSpreadsheet: (_, spreadsheetTitle: string, credentials: Credentials) =>
    createSpreadsheet(spreadsheetTitle, credentials),
  testBase44Connection: async () => {
    try {
      const config = await getConfig();
      const jsonOptions = config.outputVendors.json?.options;

      const base44Url = (jsonOptions?.base44Url || BASE44_DEFAULT_CONFIG.url).trim();
      const base44ApiKey = (jsonOptions?.base44ApiKey || BASE44_DEFAULT_CONFIG.apiKey).trim();
      const base44UserUuid = jsonOptions?.base44UserUuid?.trim();

      if (!base44UserUuid) {
        return { ok: false, status: 0, error: 'יש להזין קוד חיבור ל-MoneyMoney' };
      }
      if (!base44Url || !base44ApiKey) {
        return { ok: false, status: 0, error: 'Missing configuration' };
      }

      await sendTransactionsToBase44([], base44Url, base44ApiKey, base44UserUuid);
      return { ok: true, status: 200 };
    } catch (e) {
      return { ok: false, status: 0, error: (e as Error).message };
    }
  },
  syncJsonToBase44: async () => {
    const config = await getConfig();
    const jsonOptions = config.outputVendors.json?.options;
    if (!jsonOptions) {
      return { ok: false, error: 'JSON vendor not configured' };
    }
    try {
      const count = await syncExistingJsonToBase44(jsonOptions);
      return { ok: true, count };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export const registerHandlers = () => {
  Object.keys(functions).forEach((funcName: keyof typeof functions) => {
    ipcMain.removeHandler(funcName);
    ipcMain.handle(funcName, functions[funcName]); // Add index signature
  });

  // [CUSTOM-FIX-START]
  ipcMain.removeAllListeners('scrape');
  ipcMain.on('scrape', async (event: IpcMainEvent, configFromRenderer?: Config) => {
    const config = configFromRenderer || (await getConfig());
    const eventSubscriber = new BudgetTrackingEventEmitter();
    eventSubscriber.onAny((eventName, eventData) => {
      event.reply('scrapingProgress', JSON.stringify({ eventName, eventData }));
    });
    await setPeriodicScrapingIfNeeded(config, eventSubscriber);
    await scrapeAndUpdateOutputVendors(config, eventSubscriber);
  });
  // [CUSTOM-FIX-END]

  ipcMain.removeAllListeners('getYnabAccountData');
  ipcMain.on('getYnabAccountData', async (event, _event, ynabExporterOptions) => {
    const ynabAccountData = await getYnabAccountData(_event, ynabExporterOptions);
    event.reply('getYnabAccountData', ynabAccountData);
  });
};
