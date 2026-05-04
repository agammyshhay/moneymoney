import {
  openExternal,
  openItem,
  updateConfig,
  hasBase44Token as hasBase44TokenFn,
  onBase44TokenReceived,
  onBase44TokenExpired,
} from '#preload';
import { autorun, makeAutoObservable, toJS } from 'mobx';
import { createContext, useContext } from 'react';
import accountMetadata, { exporterUIHandlers } from '../accountMetadata';
import {
  type Account,
  AccountStatus,
  type AccountToScrapeConfig,
  AccountType,
  type BudgetTrackingEvent,
  type CompanyTypes,
  type Config,
  type DownloadChromeEvent,
  type Exporter,
  ExporterResultType,
  type Importer,
  type Log,
  OutputVendorName,
  type ExporterEndEvent,
} from '../types';
import { type ImportStartEvent } from '../../../main/src/backend/eventEmitters/EventEmitter';
// [CUSTOM-ACCOUNT-WARNINGS-START]
import { deriveAccountWarnings, type AccountWarning } from '../utils/accountHealth';
// [CUSTOM-ACCOUNT-WARNINGS-END]

interface AccountScrapingData {
  logs: Log[];
  status: AccountStatus;
}

// [CUSTOM-SUMMARY-START]
export interface ScrapeSummary {
  /** accountNumber → { vendorId, count } */
  newTransactions: Map<string, { vendorId?: string; count: number }>;
  errors: Log[];
  hasRun: boolean;
}
// [CUSTOM-SUMMARY-END]

// [CUSTOM-HISTORY-START]
export type SyncHistoryStatus = 'success' | 'partial' | 'failed';

export interface SyncHistoryAccountSummary {
  vendorId?: string;
  count: number;
}

export interface SyncHistoryEntry {
  date: string;
  /** accountNumber → { vendorId, count }. Older entries used `Record<string, number>` — handled on read. */
  newTransactions: Record<string, SyncHistoryAccountSummary>;
  errors: { message: string; vendorId?: string; errorType?: string }[];
  status: SyncHistoryStatus;
  accountsAttempted: number;
  accountsSucceeded: number;
}

const SYNC_HISTORY_VERSION = 2;
const SYNC_HISTORY_VERSION_KEY = 'syncHistoryVersion';
// [CUSTOM-HISTORY-END]

const createAccountToScrapeConfigFromImporter = (importerConfig: Importer): AccountToScrapeConfig => ({
  id: importerConfig.id,
  active: importerConfig.active,
  key: importerConfig.companyId as CompanyTypes,
  loginFields: importerConfig.loginFields,
  name: importerConfig.displayName,
  // hasCredentials is intentionally omitted — it's computed by main, never persisted
});

const createOutputVendorConfigFromExporter = (exporterConfig: Exporter) => ({
  active: exporterConfig.active,
  options: exporterConfig.options,
});

const createAccountObject = (
  id: string,
  companyId: keyof typeof accountMetadata,
  type: AccountType,
  active: boolean,
  accountScrapingData?: AccountScrapingData,
): Account => {
  const metadata = accountMetadata[companyId];
  if (!metadata) {
    throw new Error(`No metadata found for companyId ${companyId}`);
  }
  return {
    id,
    companyId,
    displayName: metadata.companyName,
    logo: metadata.logo,
    type,
    active,
    status: accountScrapingData?.status ?? AccountStatus.IDLE,
    logs: accountScrapingData?.logs ?? [],
  };
};

// Migrate older history entries (v1: Record<string, number>, boolean success) to the v2 shape.
const migrateHistoryEntry = (raw: unknown): SyncHistoryEntry | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== 'string') return null;

  const oldTx = (r.newTransactions ?? {}) as Record<string, unknown>;
  const newTransactions: Record<string, SyncHistoryAccountSummary> = {};
  Object.entries(oldTx).forEach(([key, val]) => {
    if (typeof val === 'number') {
      newTransactions[key] = { count: val };
    } else if (val && typeof val === 'object' && typeof (val as { count?: unknown }).count === 'number') {
      newTransactions[key] = val as SyncHistoryAccountSummary;
    }
  });

  const errors = Array.isArray(r.errors)
    ? (r.errors as { message?: unknown; vendorId?: unknown; errorType?: unknown }[])
        .filter((e) => typeof e.message === 'string')
        .map((e) => ({
          message: String(e.message),
          vendorId: typeof e.vendorId === 'string' ? e.vendorId : undefined,
          errorType: typeof e.errorType === 'string' ? e.errorType : undefined,
        }))
    : [];

  let status: SyncHistoryStatus;
  if (typeof r.status === 'string' && (r.status === 'success' || r.status === 'partial' || r.status === 'failed')) {
    status = r.status;
  } else {
    status = errors.length === 0 ? 'success' : 'failed';
  }

  return {
    date: r.date,
    newTransactions,
    errors,
    status,
    accountsAttempted: typeof r.accountsAttempted === 'number' ? r.accountsAttempted : 0,
    accountsSucceeded: typeof r.accountsSucceeded === 'number' ? r.accountsSucceeded : 0,
  };
};

const saveConfigIntoFile = (config?: Config) => {
  if (!config || Object.keys(config).length === 0) {
    console.warn(`Can't save config into file. Config is ${config}`);
    return;
  }
  updateConfig(toJS(config));
};

export class ConfigStore {
  config: Config;
  configLoaded = false;

  chromeDownloadPercent = 0;
  nextAutomaticScrapeDate?: Date | null;
  scrapeRunning = false;
  hasBearerToken = false;

  // [CUSTOM-SUMMARY-START]
  lastScrapeSummary: ScrapeSummary = {
    newTransactions: new Map<string, { vendorId?: string; count: number }>(),
    errors: [],
    hasRun: false,
  };
  showSummaryModal = false;
  // [CUSTOM-SUMMARY-END]

  // [CUSTOM-HISTORY-START]
  syncHistory: SyncHistoryEntry[] = [];
  // [CUSTOM-HISTORY-END]

  // TODO: move this to a separate store
  accountScrapingData: Map<CompanyTypes | OutputVendorName, AccountScrapingData>;
  constructor() {
    this.config = {
      scraping: {
        numDaysBack: 90,
        showBrowser: false,
        accountsToScrape: [],
        timeout: 72000,
        maxConcurrency: 1,
      },
      outputVendors: {
        json: {
          active: true,
          options: {
            filePath: 'transaction.json',
          },
        },
      },
    } as Config;
    this.accountScrapingData = new Map();

    // [CUSTOM-HISTORY-START]
    try {
      const savedVersion = Number(localStorage.getItem(SYNC_HISTORY_VERSION_KEY) ?? '1');
      const saved = localStorage.getItem('syncHistory');
      const parsed: unknown[] = saved ? JSON.parse(saved) : [];
      if (savedVersion < SYNC_HISTORY_VERSION) {
        this.syncHistory = parsed
          .map((raw) => migrateHistoryEntry(raw))
          .filter((entry): entry is SyncHistoryEntry => !!entry);
        localStorage.setItem(SYNC_HISTORY_VERSION_KEY, String(SYNC_HISTORY_VERSION));
        if (this.syncHistory.length > 0) {
          localStorage.setItem('syncHistory', JSON.stringify(this.syncHistory));
        }
      } else {
        this.syncHistory = parsed as SyncHistoryEntry[];
      }
    } catch {
      this.syncHistory = [];
    }
    // [CUSTOM-HISTORY-END]

    makeAutoObservable(this);

    // Check Bearer token presence on init and listen for changes
    hasBase44TokenFn().then((has) => {
      this.hasBearerToken = has;
    });
    onBase44TokenReceived(() => {
      this.hasBearerToken = true;
    });
    onBase44TokenExpired(() => {
      this.hasBearerToken = false;
    });

    autorun(() => {
      if (this.configLoaded) {
        saveConfigIntoFile(this.config);
      }
    });
  }

  updateConfig(config: Config) {
    this.configLoaded = true;
    this.config = config;
    // Set default periodic scraping interval to 2 hours if not set
    if (this.config?.scraping && !this.config.scraping.periodicScrapingIntervalHours) {
      this.config.scraping.periodicScrapingIntervalHours = 2;
    }
  }

  get importers(): Importer[] {
    if (!this.config?.scraping) return [];
    return this.config.scraping.accountsToScrape.map(({ id, key, active, loginFields, hasCredentials }) => {
      return {
        ...createAccountObject(id, key, AccountType.IMPORTER, !!active, this.accountScrapingData.get(key)),
        loginFields,
        hasCredentials,
      };
    });
  }

  get exporters(): Exporter[] {
    if (!this.config?.outputVendors) return [];
    return Object.entries(this.config.outputVendors)
      .filter(([key]) => key === OutputVendorName.JSON)
      .map(([exporterKey, exporter]) => {
        return {
          ...createAccountObject(
            exporterKey,
            exporterKey as OutputVendorName,
            AccountType.EXPORTER,
            !!exporter?.active,
            this.accountScrapingData.get(exporterKey as OutputVendorName),
          ),
          options: exporter?.options || {},
        };
      });
  }

  // [CUSTOM-ACCOUNT-WARNINGS-START]
  get accountWarnings(): AccountWarning[] {
    if (!this.config?.scraping?.accountsToScrape) return [];
    return deriveAccountWarnings(this.config.scraping.accountsToScrape, this.syncHistory);
  }
  // [CUSTOM-ACCOUNT-WARNINGS-END]

  get isScraping(): boolean {
    return (
      this.scrapeRunning ||
      !!Array.from(this.accountScrapingData.values()).find((account) => account.status === AccountStatus.IN_PROGRESS)
    );
  }

  // [CUSTOM-ONBOARDING-START]
  get isFirstRun(): boolean {
    if (!this.configLoaded) return false;
    const config = this.config;
    if (!config?.scraping) return true;
    const noAccounts = config.scraping.accountsToScrape.length === 0;
    return noAccounts && !this.hasBearerToken;
  }
  // [CUSTOM-ONBOARDING-END]

  get settings() {
    return {
      numDaysBack: this.config?.scraping.numDaysBack,
      showBrowser: this.config?.scraping.showBrowser,
    };
  }

  clearScrapingStatus() {
    this.accountScrapingData = new Map();
    this.updateChromeDownloadPercent(0);
    this.nextAutomaticScrapeDate = null;
    this.scrapeRunning = true;
  }

  // [CUSTOM-SINGLE-RUN-START]
  clearAccountScrapingData(companyId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.accountScrapingData.delete(companyId as any);
  }
  // [CUSTOM-SINGLE-RUN-END]

  updateChromeDownloadPercent(percent: number) {
    this.chromeDownloadPercent = percent;
  }

  // TODO: not need to be in a store
  openResults(exporterName: OutputVendorName) {
    const exporterConfig = this.config.outputVendors[exporterName];
    if (!exporterConfig) {
      throw new Error(`No exporter found for ${exporterName}`);
    }
    const handler = exporterUIHandlers[exporterName];
    if (!handler) {
      throw new Error(`No UI handler found for ${exporterName}`);
    }
    const { resultType, getResultUri } = handler;
    const uri = getResultUri(exporterConfig);
    if (resultType === ExporterResultType.WEBSITE_URL) {
      openExternal(uri);
    } else {
      openItem(uri);
    }
  }

  // [CUSTOM-SUMMARY-START]
  setShowSummaryModal(show: boolean) {
    this.showSummaryModal = show;
  }
  // [CUSTOM-SUMMARY-END]

  // [CUSTOM-HISTORY-START]
  addSyncHistoryEntry() {
    const txRecord: Record<string, SyncHistoryAccountSummary> = {};
    this.lastScrapeSummary.newTransactions.forEach((value, key) => {
      txRecord[key] = { vendorId: value.vendorId, count: value.count };
    });

    const errors = this.lastScrapeSummary.errors.map((err) => ({
      message: err.message,
      vendorId: err.originalEvent?.vendorId,
      errorType: err.errorType ?? err.originalEvent?.errorType,
    }));

    // Compute account-level success across importer accounts only
    const importerAccounts = this.importers.filter((imp) => imp.active);
    const accountsAttempted = importerAccounts.length;
    const accountsSucceeded = importerAccounts.filter((imp) => imp.status === AccountStatus.DONE).length;

    let status: SyncHistoryStatus;
    if (errors.length === 0) {
      status = 'success';
    } else if (accountsAttempted > 0 && accountsSucceeded === 0) {
      status = 'failed';
    } else {
      status = 'partial';
    }

    const entry: SyncHistoryEntry = {
      date: new Date().toISOString(),
      newTransactions: txRecord,
      errors,
      status,
      accountsAttempted,
      accountsSucceeded,
    };

    this.syncHistory = [entry, ...this.syncHistory].slice(0, 10);
    localStorage.setItem('syncHistory', JSON.stringify(this.syncHistory));
    localStorage.setItem(SYNC_HISTORY_VERSION_KEY, String(SYNC_HISTORY_VERSION));
  }

  clearSyncHistory() {
    this.syncHistory = [];
    localStorage.removeItem('syncHistory');
  }
  // [CUSTOM-HISTORY-END]

  handleScrapingEvent(eventName: string, budgetTrackingEvent?: BudgetTrackingEvent) {
    // [CUSTOM-SUMMARY-START]
    // Trigger modal on process completion or catastrophic failure
    // EXPORT_PROCESS_END usually has no payload (budgetTrackingEvent is undefined), so we must check this OUTSIDE the payload check.
    if (eventName === 'EXPORT_PROCESS_END' || eventName === 'GENERAL_ERROR') {
      // Safety net: reset any accounts still stuck in IN_PROGRESS
      if (eventName === 'GENERAL_ERROR') {
        this.accountScrapingData.forEach((data) => {
          if (data.status === AccountStatus.IN_PROGRESS) {
            data.status = AccountStatus.ERROR;
          }
        });
      }
      this.scrapeRunning = false;
      this.setShowSummaryModal(true);
      this.addSyncHistoryEntry();
      this.config.scraping.lastScrapeDate = new Date().toISOString();
    }
    // [CUSTOM-SUMMARY-END]

    if (budgetTrackingEvent) {
      if (eventName === 'DOWNLOAD_CHROME') {
        this.updateChromeDownloadPercent((budgetTrackingEvent as DownloadChromeEvent)?.percent);
      }
      if (eventName === 'IMPORT_PROCESS_START') {
        this.nextAutomaticScrapeDate = (budgetTrackingEvent as ImportStartEvent).nextAutomaticScrapeDate;
        // [CUSTOM-SUMMARY-START] - Reset summary on start
        this.lastScrapeSummary = {
          newTransactions: new Map<string, { vendorId?: string; count: number }>(),
          errors: [],
          hasRun: true,
        };
        // [CUSTOM-SUMMARY-END]
      }
      // [CUSTOM-SUMMARY-START] - Capture new transactions from EXPORTER_END only
      if (eventName === 'EXPORTER_END') {
        const exporterEndEvent = budgetTrackingEvent as ExporterEndEvent;
        const newTxs = exporterEndEvent.newTransactions;
        if (newTxs && newTxs.length > 0) {
          const newMap = new Map<string, { vendorId?: string; count: number }>();
          newTxs.forEach((tx) => {
            const key = tx.accountNumber ?? 'Unknown Account';
            const prev = newMap.get(key);
            newMap.set(key, {
              vendorId: prev?.vendorId ?? tx.companyId,
              count: (prev?.count ?? 0) + 1,
            });
          });
          this.lastScrapeSummary.newTransactions = newMap;
        }
      }

      if (budgetTrackingEvent.error) {
        this.lastScrapeSummary.errors.push({
          message: budgetTrackingEvent.message,
          originalEvent: budgetTrackingEvent,
          timestamp: new Date().toISOString(),
          errorType: budgetTrackingEvent.errorType,
          severity: 'error',
        });
      }
      // [CUSTOM-SUMMARY-END]

      const accountId = budgetTrackingEvent.vendorId;
      if (accountId) {
        if (!this.accountScrapingData.has(accountId)) {
          this.accountScrapingData.set(accountId, {
            logs: [],
            status: AccountStatus.IDLE,
          });
        }
        const accountScrapingData = this.accountScrapingData.get(accountId);
        if (accountScrapingData) {
          const status = budgetTrackingEvent.accountStatus ?? AccountStatus.IDLE;
          let severity: Log['severity'];
          if (budgetTrackingEvent.error !== undefined || status === AccountStatus.ERROR) severity = 'error';
          else if (status === AccountStatus.DONE) severity = 'success';
          else severity = 'info';

          accountScrapingData.logs.push({
            message: budgetTrackingEvent.message,
            originalEvent: budgetTrackingEvent,
            timestamp: new Date().toISOString(),
            errorType: budgetTrackingEvent.errorType,
            severity,
          });
          accountScrapingData.status = status;
        }
      }
    }
  }

  async addImporter(importerConfig: Importer) {
    if (!accountMetadata[importerConfig.companyId]) {
      throw new Error(`Company id ${importerConfig.companyId} is not a valid company id`);
    }
    const accountToScrapeConfig: AccountToScrapeConfig = createAccountToScrapeConfigFromImporter(importerConfig);
    this.config.scraping.accountsToScrape.push(accountToScrapeConfig);
  }

  async updateImporter(id: string, updatedImporterConfig: Importer) {
    const importerIndex = this.config.scraping.accountsToScrape.findIndex((importer) => importer.id === id);
    if (importerIndex === -1) {
      throw new Error(`Cant update importer with id ${id}. No importer with that id found`);
    }
    this.config.scraping.accountsToScrape[importerIndex] =
      createAccountToScrapeConfigFromImporter(updatedImporterConfig);
  }

  async deleteImporter(id: string) {
    this.config.scraping.accountsToScrape = this.config.scraping.accountsToScrape.filter(
      (importer) => importer.id !== id,
    );
  }

  async updateExporter(updatedExporterConfig: Exporter) {
    // @ts-expect-error the types are not complete here
    this.config.outputVendors[updatedExporterConfig.companyId as OutputVendorName] =
      createOutputVendorConfigFromExporter(updatedExporterConfig);
  }

  async setJsonFilePath(filePath: string) {
    if (!this.config.outputVendors.json) {
      this.config.outputVendors.json = {
        active: true,
        options: { filePath },
      } as unknown as Config['outputVendors']['json'];
      return;
    }
    this.config.outputVendors.json.options.filePath = filePath;
  }

  // [CUSTOM-STARTUP-START]
  toggleRunAtStartup() {
    this.config.runAtStartup = !(this.config.runAtStartup ?? true);
  }

  toggleMinimizeToTray() {
    this.config.minimizeToTray = !(this.config.minimizeToTray ?? true);
  }
  // [CUSTOM-STARTUP-END]

  async toggleShowBrowser() {
    this.config.scraping.showBrowser = !this.config.scraping.showBrowser;
  }

  async setNumDaysBack(numDaysBack: number) {
    this.config.scraping.numDaysBack = numDaysBack;
  }

  async setTimeout(timeout: number) {
    this.config.scraping.timeout = timeout;
  }

  async setMaxConcurrency(maxConcurrency: number) {
    this.config.scraping.maxConcurrency = maxConcurrency;
  }

  async setChromiumPath(chromiumPath?: string) {
    this.config.scraping.chromiumPath = chromiumPath;
  }

  setPeriodicScrapingIntervalHours(interval?: number) {
    this.config.scraping.periodicScrapingIntervalHours = interval;
    if (!interval || interval <= 0) {
      this.nextAutomaticScrapeDate = null;
    }
  }
}

export const configStore = new ConfigStore();
const StoreContext = createContext<ConfigStore>(configStore);
export const ConfigStoreProvider = ({ children }: { children: React.ReactNode }) => (
  <StoreContext.Provider value={configStore}>{children}</StoreContext.Provider>
);
export const useConfigStore = () => useContext(StoreContext);
