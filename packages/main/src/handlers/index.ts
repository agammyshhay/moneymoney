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
import {
  sendTransactionsToBase44,
  sendTransactionsToBase44WithBearer,
  syncExistingJsonToBase44,
  Base44RequestError,
} from '@/backend/export/outputVendors/json/json';
// [CUSTOM-BASE44-START]
import {
  getBase44Token,
  hasBase44Token as hasBase44TokenFn,
  clearBase44Token as clearBase44TokenFn,
  generateAuthNonce,
} from '@/backend/auth/base44Token';
// [CUSTOM-BASE44-END]
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

      // [CUSTOM-BASE44-START]
      // Try Bearer token first
      const bearerToken = await getBase44Token();
      if (bearerToken) {
        try {
          await sendTransactionsToBase44WithBearer([], base44Url, bearerToken);
          return { ok: true, status: 200 };
        } catch (e) {
          if (e instanceof Base44RequestError && e.statusCode === 401) {
            await clearBase44TokenFn();
            return { ok: false, status: 401, error: 'הטוקן פג תוקף, יש להתחבר מחדש' };
          }
          return { ok: false, status: 0, error: (e as Error).message };
        }
      }
      // [CUSTOM-BASE44-END]

      // Legacy fallback
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
      // [CUSTOM-BASE44-START]
      if (e instanceof Base44RequestError && e.statusCode === 401) {
        return { ok: false, error: 'token_expired' };
      }
      // [CUSTOM-BASE44-END]
      return { ok: false, error: (e as Error).message };
    }
  },
  // [CUSTOM-BASE44-START]
  hasBase44Token: async () => {
    return hasBase44TokenFn();
  },
  clearBase44Token: async () => {
    await clearBase44TokenFn();
    return { ok: true };
  },
  getBase44ConnectUrl: () => {
    const nonce = generateAuthNonce();
    const url = new URL('https://moneym.base44.app/desktop-connect-code');
    url.searchParams.set('state', nonce);
    return url.toString();
  },
  // [CUSTOM-BASE44-END]
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
