import { App } from '@/app-globals';
import { scrapeAndUpdateOutputVendors, setPeriodicScrapingIfNeeded, stopPeriodicScraping } from '@/backend';
import { type Config, type Credentials } from '@/backend/commonTypes';
import { getConfig } from '@/backend/configManager/configManager';
import { BudgetTrackingEventEmitter } from '@/backend/eventEmitters/EventEmitter';
import electronGoogleOAuth2Connector from '@/backend/export/outputVendors/googleSheets/electronGoogleOAuth2Connector';
import { createClient, validateToken } from '@/backend/export/outputVendors/googleSheets/googleAuth';
import { createSpreadsheet } from '@/backend/export/outputVendors/googleSheets/googleSheets';
import { getAllSpreadsheets } from '@/backend/export/outputVendors/googleSheets/googleSheetsInternalAPI';
import { getYnabAccountData } from '@/manual/setupHelpers';
import { syncExistingJsonToBase44 } from '@/backend/export/outputVendors/json/json';
import { dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import http from 'http';
import https from 'https';
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
    const config = await getConfig();
    const jsonOptions = config.outputVendors.json?.options;

    // Use defaults if not provided in config
    const urlStr = (jsonOptions?.base44Url || BASE44_DEFAULT_CONFIG.url).trim();
    const base44ApiKey = jsonOptions?.base44ApiKey || BASE44_DEFAULT_CONFIG.apiKey;

    if (!urlStr || !base44ApiKey) {
      return { ok: false, status: 0, error: 'Missing configuration' };
    }

    try {
      const urlObj = new URL(urlStr);
      const isHttps = urlObj.protocol === 'https:';
      const requestLib = isHttps ? https : http;

      let payload: unknown;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-secret': base44ApiKey,
        'User-Agent': 'MoneyMoney/1.0.0',
        Accept: 'application/json',
      };

      if (jsonOptions?.base44UserUuid) {
        payload = {
          user_uuid: jsonOptions.base44UserUuid,
          transactions: [],
        };
      } else {
        // Fallback for when UUID is missing, though the server might reject it.
        // We try to send a valid-ish structure or just a ping if that's what we have.
        // Based on the snippet, user_uuid is required.
        // Let's send a dummy or empty one if we can't do better, or maybe the user hasn't set it yet.
        // For testing connection, we'll try to send the structure with empty uuid or null.
        payload = {
          user_uuid: '',
          transactions: [],
        };
      }

      const body = JSON.stringify(payload);
      headers['Content-Length'] = Buffer.byteLength(body).toString();

      const resObj = await new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
        const req = requestLib.request(
          {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: `${urlObj.pathname}${urlObj.search}`,
            method: 'POST',
            headers,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
            res.on('end', () => {
              resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
            });
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      const ok = !!resObj.statusCode && resObj.statusCode >= 200 && resObj.statusCode < 300;
      const error = !ok
        ? `Status ${resObj.statusCode} from ${urlStr}. Body: ${resObj.body.substring(0, 500)}`
        : undefined;
      return { ok, status: resObj.statusCode ?? 0, body: resObj.body, error };
    } catch (e) {
      return { ok: false, status: 0, error: `Error with ${urlStr}: ${(e as Error).message}` };
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
