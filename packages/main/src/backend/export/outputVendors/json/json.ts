import {
  OutputVendorName,
  type EnrichedTransaction,
  type ExportTransactionsFunction,
  type OutputVendor,
} from '@/backend/commonTypes';
import { mergeTransactions, sortByDate, unifyHash } from '@/backend/transactions/transactions';
import { userDataPath } from '@/app-globals';
import { promises as fs } from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import logger from '/@/logging/logger';
import { BASE44_DEFAULT_CONFIG } from '@/config/base44';
// [CUSTOM-BASE44-START]
import { getBase44Token, clearBase44Token } from '@/backend/auth/base44Token';
import { BrowserWindow } from 'electron';
// [CUSTOM-BASE44-END]

// [CUSTOM-BASE44-START]
export class Base44RequestError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'Base44RequestError';
    this.statusCode = statusCode;
  }
}
// [CUSTOM-BASE44-END]

const resolveFilePath = (fp: string) => (path.isAbsolute(fp) ? fp : path.resolve(userDataPath, fp));

const parseTransactionsFile = async (filename: string) => {
  try {
    const content = await fs.readFile(filename, { encoding: 'utf8' });
    return JSON.parse(content) as EnrichedTransaction[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [] as EnrichedTransaction[];
    }
    logger.error('Failed to parse JSON file', err);
    throw err;
  }
};

const postJson = async (urlStr: string, payload: unknown, extraHeaders?: Record<string, string>) =>
  new Promise<void>((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const body = JSON.stringify(payload);
      const isHttps = urlObj.protocol === 'https:';
      const requestLib = isHttps ? https : http;

      const req = requestLib.request(
        {
          protocol: urlObj.protocol,
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: `${urlObj.pathname}${urlObj.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
            'User-Agent': 'MoneyMoney/1.0.0',
            Accept: 'application/json',
            ...(extraHeaders ?? {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(
                new Base44RequestError(
                  res.statusCode ?? 0,
                  `BASE44 request failed (${res.statusCode}): ${responseBody}`,
                ),
              );
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });

const exportTransactions: ExportTransactionsFunction = async ({ transactionsToCreate, outputVendorsConfig }) => {
  const filePath = resolveFilePath(outputVendorsConfig.json!.options.filePath);
  const savedTransactions = await parseTransactionsFile(filePath);
  const mergedTransactions = mergeTransactions(savedTransactions, transactionsToCreate);
  const sorted = sortByDate(mergedTransactions);
  await fs.writeFile(filePath, JSON.stringify(sorted, null, 4));

  // Use configured values, falling back to hardcoded defaults (same logic as syncExistingJsonToBase44)
  const trimmedUrl = (outputVendorsConfig.json!.options.base44Url || '').trim();
  const trimmedApiKey = (outputVendorsConfig.json!.options.base44ApiKey || '').trim();
  const base44Url = trimmedUrl || BASE44_DEFAULT_CONFIG.url;
  const base44ApiKey = trimmedApiKey || BASE44_DEFAULT_CONFIG.apiKey;
  const base44UserUuid = outputVendorsConfig.json!.options.base44UserUuid;

  // [CUSTOM-BASE44-START]
  try {
    await syncWithBearerOrFallback(sorted, base44Url, base44ApiKey, base44UserUuid);
  } catch (e) {
    logger.error('Failed to sync to BASE44', e);
  }
  // [CUSTOM-BASE44-END]

  const savedHashes = new Set(savedTransactions.map((t) => unifyHash(t.hash)));
  const newTransactions = sorted.filter((t) => !savedHashes.has(unifyHash(t.hash)));

  return {
    exportedTransactionsNum: newTransactions.length,
    newTransactions,
  };
};

// SECURITY: The caller-supplied user_uuid is trusted by the syncData function on Base44.
// Server-side must validate that user_uuid matches the authenticated user.
// TODO (Phase 4): Replace x-api-secret with per-user Bearer tokens so the server
// extracts user identity from the token instead of trusting the payload.
export const sendTransactionsToBase44 = async (
  transactions: EnrichedTransaction[],
  base44Url: string,
  base44ApiKey: string,
  base44UserUuid: string,
) => {
  try {
    logger.info(`Sending ${transactions.length} transactions to BASE44`);
    const headers: Record<string, string> = {
      'x-api-secret': base44ApiKey,
      'User-Agent': 'MoneyMoney/1.0.0',
      Accept: 'application/json',
    };
    const payload = {
      user_uuid: base44UserUuid,
      transactions: transactions.map((t) => ({
        hash: t.hash,
        date: t.date,
        description: t.description,
        chargedAmount: t.chargedAmount,
        sum: t.chargedAmount,
        chargedCurrency: t.originalCurrency || 'ILS',
        processedDate: t.processedDate,
        memo: t.memo,
        status: t.status,
        category: t.category,
        accountNumber: t.accountNumber ? t.accountNumber.slice(-4) : null,
        type: t.type,
      })),
    };

    await postJson(base44Url, payload, headers);
    logger.info('Successfully sent transactions to BASE44');
  } catch (e) {
    logger.error('Failed to send transactions to BASE44', e);
    throw e; // Re-throw so caller knows it failed
  }
};

// [CUSTOM-BASE44-START]
function notifyTokenExpired() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('base44-token-expired');
  }
}

export const sendTransactionsToBase44WithBearer = async (
  transactions: EnrichedTransaction[],
  base44Url: string,
  token: string,
) => {
  logger.info(`Sending ${transactions.length} transactions to BASE44 (Bearer auth)`);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'MoneyMoney/1.0.0',
    Accept: 'application/json',
  };
  const payload = {
    transactions: transactions.map((t) => ({
      hash: t.hash,
      date: t.date,
      description: t.description,
      chargedAmount: t.chargedAmount,
      sum: t.chargedAmount,
      chargedCurrency: t.originalCurrency || 'ILS',
      processedDate: t.processedDate,
      memo: t.memo,
      status: t.status,
      category: t.category,
      accountNumber: t.accountNumber ? t.accountNumber.slice(-4) : null,
      type: t.type,
    })),
  };

  await postJson(base44Url, payload, headers);
  logger.info('Successfully sent transactions to BASE44 (Bearer auth)');
};

async function syncWithBearerOrFallback(
  transactions: EnrichedTransaction[],
  base44Url: string,
  base44ApiKey: string,
  base44UserUuid: string | undefined,
): Promise<void> {
  const bearerToken = await getBase44Token();
  if (bearerToken) {
    try {
      await sendTransactionsToBase44WithBearer(transactions, base44Url, bearerToken);
      return;
    } catch (e) {
      if (e instanceof Base44RequestError && e.statusCode === 401) {
        logger.warn('Bearer token expired, clearing token');
        await clearBase44Token();
        notifyTokenExpired();
        // Fall through to legacy method
      } else {
        throw e;
      }
    }
  }

  // Legacy fallback
  if (base44ApiKey && base44UserUuid) {
    await sendTransactionsToBase44(transactions, base44Url, base44ApiKey, base44UserUuid);
  } else if (!bearerToken) {
    logger.info('No Bearer token or legacy credentials configured. Skipping BASE44 sync.');
  }
}
// [CUSTOM-BASE44-END]

export const syncExistingJsonToBase44 = async (options: {
  filePath: string;
  base44Url?: string;
  base44ApiKey?: string;
  base44UserUuid?: string;
}) => {
  const transactions = await parseTransactionsFile(resolveFilePath(options.filePath));
  const trimmedBase44Url = options.base44Url?.trim();
  const trimmedBase44ApiKey = options.base44ApiKey?.trim();
  const base44Url = trimmedBase44Url ? trimmedBase44Url : BASE44_DEFAULT_CONFIG.url;
  const base44ApiKey = trimmedBase44ApiKey ? trimmedBase44ApiKey : BASE44_DEFAULT_CONFIG.apiKey;
  const base44UserUuid = options.base44UserUuid;

  // [CUSTOM-BASE44-START]
  const bearerToken = await getBase44Token();
  if (bearerToken) {
    try {
      await sendTransactionsToBase44WithBearer(transactions, base44Url, bearerToken);
      return transactions.length;
    } catch (e) {
      if (e instanceof Base44RequestError && e.statusCode === 401) {
        logger.warn('Bearer token expired during manual sync, clearing token');
        await clearBase44Token();
        notifyTokenExpired();
        // Fall through to legacy method
      } else {
        throw e;
      }
    }
  }
  // [CUSTOM-BASE44-END]

  if (base44Url && base44ApiKey && base44UserUuid) {
    await sendTransactionsToBase44(transactions, base44Url, base44ApiKey, base44UserUuid);
    return transactions.length;
  }
  if (!base44UserUuid) {
    throw new Error('BASE44 User UUID not configured');
  }
  throw new Error('BASE44 URL or API Key not configured');
};

export default {
  name: OutputVendorName.JSON,
  exportTransactions,
} as OutputVendor;
