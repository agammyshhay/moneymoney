import {
  OutputVendorName,
  type EnrichedTransaction,
  type ExportTransactionsFunction,
  type OutputVendor,
} from '@/backend/commonTypes';
import { mergeTransactions, sortByDate, unifyHash } from '@/backend/transactions/transactions';
import { userDataPath } from '@/app-globals';
// [CUSTOM-FIX-START] Atomic writes + per-file mutex + corruption recovery for transaction.json
import { writeFileAtomic } from '@/utils/atomicWrite';
import { withFileLock } from '@/utils/fileMutex';
// [CUSTOM-FIX-END]
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

// [CUSTOM-FIX-START] Recover a transaction.json that got corrupted by overlapping writes.
// The observed corruption welds two arrays together at a `]   {` seam: array N closes,
// array N+1's objects begin without an opening `[`. Turning each `]<ws>{` into `,{` welds
// them into one valid array. A false-positive seam (e.g. `]{` inside a string value) makes
// the parse below fail → we return null and the caller re-throws after backing the file up.
export const tryRecoverTransactionsJson = (content: string): EnrichedTransaction[] | null => {
  try {
    const welded = content.replace(/]\s*{/g, ',{');
    const parsed = JSON.parse(welded);
    if (!Array.isArray(parsed)) {
      return null;
    }
    // mergeTransactions(parsed, []) dedupes by unifyHash — the same dedupe the app trusts.
    return sortByDate(mergeTransactions(parsed as EnrichedTransaction[], []));
  } catch {
    return null;
  }
};
// [CUSTOM-FIX-END]

export const parseTransactionsFile = async (filename: string) => {
  let content = '';
  try {
    content = await fs.readFile(filename, { encoding: 'utf8' });
    return JSON.parse(content) as EnrichedTransaction[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [] as EnrichedTransaction[];
    }
    // [CUSTOM-FIX-START] Auto-recover from corruption instead of failing the whole sync.
    // Never return [] on a parse error — that would make mergeTransactions overwrite all history.
    if (err instanceof SyntaxError) {
      logger.warn('transaction.json is corrupt — attempting recovery', err);
      await fs.copyFile(filename, `${filename}.corrupt-${Date.now()}`); // never lose the original
      const repaired = tryRecoverTransactionsJson(content);
      if (repaired) {
        logger.info(`Recovered ${repaired.length} transactions from corrupt file`);
        await writeFileAtomic(filename, JSON.stringify(repaired, null, 4)); // heal on disk
        return repaired;
      }
    }
    // [CUSTOM-FIX-END]
    logger.error('Failed to parse JSON file', err);
    throw err;
  }
};

const postJson = async (urlStr: string, payload: unknown, extraHeaders?: Record<string, string>) =>
  new Promise<void>((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      // [CUSTOM-FIX-START] Enforce HTTPS for all Base44 traffic to prevent credential leakage.
      // Exception: localhost/127.0.0.1 allowed (used for local dev testing only).
      const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
      if (urlObj.protocol !== 'https:' && !isLocalhost) {
        reject(new Error('BASE44 URL must use HTTPS'));
        return;
      }
      // [CUSTOM-FIX-END]
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
  // [CUSTOM-FIX-START] Serialize the read-merge-write so concurrent scrapes/syncs can't
  // clobber each other (lost updates) or interleave their writes (torn-file corruption).
  const { sorted, savedTransactions } = await withFileLock(filePath, async () => {
    const saved = await parseTransactionsFile(filePath);
    const mergedTransactions = mergeTransactions(saved, transactionsToCreate);
    const sortedTransactions = sortByDate(mergedTransactions);
    await writeFileAtomic(filePath, JSON.stringify(sortedTransactions, null, 4));
    return { sorted: sortedTransactions, savedTransactions: saved };
  });
  // [CUSTOM-FIX-END]

  // [CUSTOM-BASE44-START]
  // Sync runs outside the file lock — a network call must not block other scrapes.
  try {
    await syncToBase44(sorted);
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

// [CUSTOM-BASE44-START]
function notifyTokenExpired() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('base44-token-expired');
  }
}

const BASE44_BATCH_SIZE = 500;

const mapTransaction = (t: EnrichedTransaction) => ({
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
});

export const sendTransactionsToBase44 = async (
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

  // Empty array → single request (connectivity test from testBase44Connection)
  if (transactions.length === 0) {
    await postJson(base44Url, { transactions: [] }, headers);
    logger.info('Successfully sent transactions to BASE44 (Bearer auth)');
    return;
  }

  const totalBatches = Math.ceil(transactions.length / BASE44_BATCH_SIZE);
  for (let i = 0; i < transactions.length; i += BASE44_BATCH_SIZE) {
    const batch = transactions.slice(i, i + BASE44_BATCH_SIZE);
    const batchNum = Math.floor(i / BASE44_BATCH_SIZE) + 1;
    if (totalBatches > 1) {
      logger.info(`Sending batch ${batchNum}/${totalBatches} (${batch.length} transactions)`);
    }
    await postJson(base44Url, { transactions: batch.map(mapTransaction) }, headers);
  }

  logger.info('Successfully sent transactions to BASE44 (Bearer auth)');
};

async function syncToBase44(transactions: EnrichedTransaction[]): Promise<void> {
  const bearerToken = await getBase44Token();
  if (!bearerToken) {
    logger.info('No Bearer token configured. Skipping BASE44 sync.');
    return;
  }
  try {
    await sendTransactionsToBase44(transactions, BASE44_DEFAULT_CONFIG.url, bearerToken);
  } catch (e) {
    if (e instanceof Base44RequestError && e.statusCode === 401) {
      logger.warn('Bearer token expired, clearing token');
      await clearBase44Token();
      notifyTokenExpired();
    } else {
      throw e;
    }
  }
}
// [CUSTOM-BASE44-END]

export const syncExistingJsonToBase44 = async (options: { filePath: string }) => {
  const filePath = resolveFilePath(options.filePath);
  // [CUSTOM-FIX-START] Read under the file lock so we wait for any in-flight write and
  // read a complete file; the lock is released before the network POST below.
  const transactions = await withFileLock(filePath, () => parseTransactionsFile(filePath));
  // [CUSTOM-FIX-END]

  // [CUSTOM-BASE44-START]
  const bearerToken = await getBase44Token();
  if (!bearerToken) {
    throw new Error('לא מחובר ל-MoneyMoney. יש להתחבר מחדש.');
  }
  try {
    await sendTransactionsToBase44(transactions, BASE44_DEFAULT_CONFIG.url, bearerToken);
    return transactions.length;
  } catch (e) {
    if (e instanceof Base44RequestError && e.statusCode === 401) {
      logger.warn('Bearer token expired during manual sync, clearing token');
      await clearBase44Token();
      notifyTokenExpired();
    }
    throw e;
  }
  // [CUSTOM-BASE44-END]
};

export default {
  name: OutputVendorName.JSON,
  exportTransactions,
} as OutputVendor;
