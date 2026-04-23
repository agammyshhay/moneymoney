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
import { dialog, ipcMain, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { discord, repository } from '../../../../package.json';
import os from 'os';
import { getConfigHandler, updateConfigHandler, updateImporterCredentialsHandler } from './configHandlers';
import { BASE44_DEFAULT_CONFIG } from '@/config/base44';
import { getLogsInfoHandler } from './logsHandlers';
import { checkForUpdate, downloadUpdate, getUpdateStatus, quitAndInstall } from './updater';

type Listener<T = unknown> = (
  event: IpcMainInvokeEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Promise<T> | T;

// [CUSTOM-FIX-START] Simple min-interval rate limiter. Prevents a compromised renderer from
// spamming expensive operations (bank logins, external API calls, file I/O). If a call comes
// in sooner than `minIntervalMs` after the previous one, it is silently dropped and the prior
// result (or a benign default) is returned.
const rateLimiterState = new Map<string, number>();
function rateLimited<TArgs extends unknown[], TReturn>(
  key: string,
  minIntervalMs: number,
  fallback: TReturn,
  fn: (...args: TArgs) => Promise<TReturn> | TReturn,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const now = Date.now();
    const last = rateLimiterState.get(key) ?? 0;
    if (now - last < minIntervalMs) {
      return fallback;
    }
    rateLimiterState.set(key, now);
    return fn(...args);
  };
}

// Shell helpers moved from preload to main so the renderer can run under sandbox: true.
// Validation runs here (authoritative) — the preload is just a thin IPC proxy.
const DANGEROUS_FILE_EXT = /\.(exe|bat|cmd|com|msi|ps1|vbs|js|wsf|scr|lnk|pif|jar|py|rb|hta|reg|gadget)$/i;

async function shellOpenExternal(_: unknown, url: unknown): Promise<void> {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  await shell.openExternal(url);
}

async function shellOpenItem(_: unknown, filePath: unknown): Promise<void> {
  if (typeof filePath !== 'string') return;
  // Block path traversal and dangerous executable extensions
  if (filePath.includes('..') || DANGEROUS_FILE_EXT.test(filePath)) return;
  await shell.openPath(filePath);
}
// [CUSTOM-FIX-END]

const functions: Record<string, Listener> = {
  showSaveDialog: async () => {
    const dir = await dialog.showSaveDialog({});
    return dir.filePath;
  },
  openExternal: shellOpenExternal,
  openItem: shellOpenItem,
  checkForUpdate: rateLimited('checkForUpdate', 30_000, false, checkForUpdate),
  downloadUpdate: rateLimited('downloadUpdate', 60_000, undefined, downloadUpdate),
  quitAndInstall,
  getUpdateStatus,
  getConfig: getConfigHandler,
  updateConfig: updateConfigHandler as Listener<void>,
  updateImporterCredentials: rateLimited(
    'updateImporterCredentials',
    1_000,
    undefined,
    updateImporterCredentialsHandler as Listener<void>,
  ),
  getYnabAccountData,
  getLogsInfo: rateLimited('getLogsInfo', 500, { lastLines: '', logsFolder: '' }, getLogsInfoHandler),
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
  testBase44Connection: rateLimited(
    'testBase44Connection',
    2_000,
    { ok: false, status: 0, error: 'rate_limited' },
    async () => {
      try {
        // [CUSTOM-BASE44-START]
        const bearerToken = await getBase44Token();
        if (!bearerToken) {
          return { ok: false, status: 0, error: 'לא מחובר ל-MoneyMoney. יש להתחבר.' };
        }
        try {
          await sendTransactionsToBase44([], BASE44_DEFAULT_CONFIG.url, bearerToken);
          return { ok: true, status: 200 };
        } catch (e) {
          if (e instanceof Base44RequestError && e.statusCode === 401) {
            await clearBase44TokenFn();
            return { ok: false, status: 401, error: 'הטוקן פג תוקף, יש להתחבר מחדש' };
          }
          return { ok: false, status: 0, error: (e as Error).message };
        }
        // [CUSTOM-BASE44-END]
      } catch (e) {
        return { ok: false, status: 0, error: (e as Error).message };
      }
    },
  ),
  syncJsonToBase44: rateLimited('syncJsonToBase44', 5_000, { ok: false, error: 'rate_limited' }, async () => {
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
  }),
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

  // [CUSTOM-FIX-START] Security: credentials are loaded from disk in the main process only.
  // The renderer can optionally pass a single accountId to run one account, but NEVER
  // a config with credentials (prevents XSS-compromised renderer from redirecting bank logins).
  ipcMain.removeAllListeners('scrape');
  ipcMain.on('scrape', async (event: IpcMainEvent, accountIdFilter?: unknown) => {
    // Rate limit: scrape is expensive (real bank logins) — block spam from compromised renderer.
    const last = rateLimiterState.get('scrape') ?? 0;
    if (Date.now() - last < 5_000) {
      return;
    }
    rateLimiterState.set('scrape', Date.now());

    const fullConfig = await getConfig();
    let config: Config = fullConfig;
    if (typeof accountIdFilter === 'string' && accountIdFilter.length > 0) {
      const account = fullConfig.scraping.accountsToScrape.find((a) => a.id === accountIdFilter);
      if (account) {
        config = {
          ...fullConfig,
          scraping: {
            ...fullConfig.scraping,
            accountsToScrape: [account],
          },
        };
      }
    }
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
