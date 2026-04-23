import { configFilePath } from '@/app-globals';
import { type Config } from '@/backend/commonTypes';
import { getConfig, updateConfig } from '@/backend/configManager/configManager';
// [CUSTOM-STARTUP-START]
import { app } from 'electron';
import { platform } from 'node:process';
// [CUSTOM-STARTUP-END]

// Mutex to serialize config file read-modify-write operations, preventing races
// between concurrent updateConfig / updateImporterCredentials calls.
let configLock = Promise.resolve();
function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = configLock;
  let release: () => void;
  configLock = new Promise((r) => {
    release = r;
  });
  return prev.then(fn).finally(() => release());
}

// [CUSTOM-FIX-START] — Strip credentials before sending config to renderer
function sanitizeConfigForRenderer(config: Config): Config {
  const sanitized = structuredClone(config);
  for (const account of sanitized.scraping.accountsToScrape) {
    account.hasCredentials = Object.values(account.loginFields).some((v) => v.length > 0);
    account.loginFields = {} as typeof account.loginFields;
  }
  // Strip disabled-but-present exporter credentials
  if (sanitized.outputVendors.ynab?.options) {
    sanitized.outputVendors.ynab.options.accessToken = '';
  }
  if (sanitized.outputVendors.googleSheets?.options) {
    sanitized.outputVendors.googleSheets.options.credentials =
      {} as typeof sanitized.outputVendors.googleSheets.options.credentials;
  }
  return sanitized;
}
// [CUSTOM-FIX-END]

export async function getConfigHandler(): Promise<string> {
  const config = await getConfig();
  const sanitized = sanitizeConfigForRenderer(config);
  return JSON.stringify({ config: sanitized });
}

// [CUSTOM-FIX-START] — Merge incoming (credential-stripped) config with disk config
function mergePreservingCredentials(existing: Config, incoming: Config): Config {
  const merged = structuredClone(incoming);

  // Build a lookup of existing accounts by id
  const existingAccountsById = new Map(existing.scraping.accountsToScrape.map((a) => [a.id, a]));

  for (const account of merged.scraping.accountsToScrape) {
    const diskAccount = existingAccountsById.get(account.id);
    if (diskAccount) {
      // Existing account: restore credentials from disk
      account.loginFields = diskAccount.loginFields;
    }
    // New account (no disk match): keep incoming loginFields (from CreateImporter flow)
    // Remove the computed hasCredentials field — it should never be persisted
    delete account.hasCredentials;
  }

  // Preserve exporter credentials from disk
  if (existing.outputVendors.ynab?.options?.accessToken && merged.outputVendors.ynab?.options) {
    merged.outputVendors.ynab.options.accessToken = existing.outputVendors.ynab.options.accessToken;
  }
  if (existing.outputVendors.googleSheets?.options?.credentials && merged.outputVendors.googleSheets?.options) {
    merged.outputVendors.googleSheets.options.credentials = existing.outputVendors.googleSheets.options.credentials;
  }

  return merged;
}
// [CUSTOM-FIX-END]

export async function updateConfigHandler(_: unknown, configStr: string) {
  return withConfigLock(async () => {
    const incoming = JSON.parse(configStr) as Config;
    const existing = await getConfig();
    const merged = mergePreservingCredentials(existing, incoming);

    await updateConfig(configFilePath, merged);
    // [CUSTOM-STARTUP-START]
    // Apply runAtStartup setting immediately
    if (platform === 'win32' && import.meta.env.PROD) {
      const runAtStartup = merged.runAtStartup ?? true;
      const appFolder = app.getPath('exe');
      app.setLoginItemSettings({
        openAtLogin: runAtStartup,
        path: appFolder,
        args: ['--hidden'],
      });
    }
    // [CUSTOM-STARTUP-END]
  });
}

// [CUSTOM-FIX-START] — Dedicated handler for credential writes.
// Credentials go directly from EditImporter → main process → disk,
// never entering the renderer's MobX store.
export async function updateImporterCredentialsHandler(_: unknown, accountId: string, loginFieldsStr: string) {
  return withConfigLock(async () => {
    if (typeof accountId !== 'string' || !accountId) {
      throw new Error('Invalid accountId');
    }
    const loginFields = JSON.parse(loginFieldsStr);
    if (typeof loginFields !== 'object' || loginFields === null || Array.isArray(loginFields)) {
      throw new Error('Invalid loginFields');
    }

    const config = await getConfig();
    const account = config.scraping.accountsToScrape.find((a) => a.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    account.loginFields = loginFields;
    await updateConfig(configFilePath, config);
  });
}
// [CUSTOM-FIX-END]
