import { openExternal, openItem, updateConfig } from '#preload';
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

interface AccountScrapingData {
  logs: Log[];
  status: AccountStatus;
}

// [CUSTOM-SUMMARY-START]
export interface ScrapeSummary {
  newTransactions: Map<string, number>;
  errors: Log[];
  hasRun: boolean;
}
// [CUSTOM-SUMMARY-END]

// [CUSTOM-HISTORY-START]
export interface SyncHistoryEntry {
  date: string;
  newTransactions: Record<string, number>;
  errors: { message: string; vendorId?: string }[];
  success: boolean;
}
// [CUSTOM-HISTORY-END]

const createAccountToScrapeConfigFromImporter = (importerConfig: Importer): AccountToScrapeConfig => ({
  id: importerConfig.id,
  active: importerConfig.active,
  key: importerConfig.companyId as CompanyTypes,
  loginFields: importerConfig.loginFields,
  name: importerConfig.displayName,
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

const saveConfigIntoFile = (config?: Config) => {
  if (!config || Object.keys(config).length === 0) {
    console.warn(`Can't save config into file. Config is ${config}`);
    return;
  }
  updateConfig(toJS(config));
};

export class ConfigStore {
  config: Config;

  chromeDownloadPercent = 0;
  nextAutomaticScrapeDate?: Date | null;

  // [CUSTOM-SUMMARY-START]
  lastScrapeSummary: ScrapeSummary = {
    newTransactions: new Map(),
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
        maxConcurrency: 6,
      },
      outputVendors: {
        json: {
          active: true,
          options: {
            filePath: 'transaction.json',
            base44Url: '',
            base44ApiKey: '',
            base44UserUuid: '',
          },
        },
      },
    } as Config;
    this.accountScrapingData = new Map();

    // [CUSTOM-HISTORY-START]
    try {
      const saved = localStorage.getItem('syncHistory');
      this.syncHistory = saved ? JSON.parse(saved) : [];
    } catch {
      this.syncHistory = [];
    }
    // [CUSTOM-HISTORY-END]

    makeAutoObservable(this);

    autorun(() => {
      saveConfigIntoFile(this.config);
    });
  }

  updateConfig(config: Config) {
    this.config = config;
    // Set default periodic scraping interval to 2 hours if not set
    if (this.config?.scraping && !this.config.scraping.periodicScrapingIntervalHours) {
      this.config.scraping.periodicScrapingIntervalHours = 2;
    }
  }

  get importers(): Importer[] {
    if (!this.config?.scraping) return [];
    return this.config.scraping.accountsToScrape.map(({ id, key, active, loginFields }) => {
      return {
        ...createAccountObject(id, key, AccountType.IMPORTER, !!active, this.accountScrapingData.get(key)),
        loginFields,
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

  get isScraping(): boolean {
    return !!Array.from(this.accountScrapingData.values()).find(
      (account) => account.status === AccountStatus.IN_PROGRESS,
    );
  }

  // [CUSTOM-ONBOARDING-START]
  get isFirstRun(): boolean {
    const config = this.config;
    if (!config?.scraping) return true;
    const noAccounts = config.scraping.accountsToScrape.length === 0;
    const noUuid = !config.outputVendors?.json?.options?.base44UserUuid;
    return noAccounts && noUuid;
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
    const txRecord: Record<string, number> = {};
    this.lastScrapeSummary.newTransactions.forEach((count, key) => {
      txRecord[key] = count;
    });

    const errors = this.lastScrapeSummary.errors.map((err) => ({
      message: err.message,
      vendorId: err.originalEvent?.vendorId,
    }));

    const entry: SyncHistoryEntry = {
      date: new Date().toISOString(),
      newTransactions: txRecord,
      errors,
      success: errors.length === 0,
    };

    this.syncHistory = [entry, ...this.syncHistory].slice(0, 10);
    localStorage.setItem('syncHistory', JSON.stringify(this.syncHistory));
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
      this.setShowSummaryModal(true);
      this.addSyncHistoryEntry();
      if (eventName === 'EXPORT_PROCESS_END') {
        this.config.scraping.lastScrapeDate = new Date().toISOString();
      }
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
          newTransactions: new Map(),
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
          const newMap = new Map<string, number>();
          newTxs.forEach((tx) => {
            const key = tx.accountNumber ?? 'Unknown Account';
            newMap.set(key, (newMap.get(key) ?? 0) + 1);
          });
          this.lastScrapeSummary.newTransactions = newMap;
        }
      }

      if (budgetTrackingEvent.error) {
        this.lastScrapeSummary.errors.push({
          message: budgetTrackingEvent.message,
          originalEvent: budgetTrackingEvent,
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
          accountScrapingData.logs.push({
            message: budgetTrackingEvent.message,
            originalEvent: budgetTrackingEvent,
          });
          accountScrapingData.status = budgetTrackingEvent.accountStatus ?? AccountStatus.IDLE;
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

  // [CUSTOM-BASE44-START] - Base44 Config Setters
  async setBase44Url(url?: string) {
    if (!this.config.outputVendors.json) {
      this.config.outputVendors.json = {
        active: true,
        options: { filePath: '', base44Url: url ?? '' },
      } as unknown as Config['outputVendors']['json'];
      return;
    }
    this.config.outputVendors.json.options.base44Url = url ?? '';
  }

  // [CUSTOM-STARTUP-START]
  toggleRunAtStartup() {
    this.config.runAtStartup = !(this.config.runAtStartup ?? true);
  }

  toggleMinimizeToTray() {
    this.config.minimizeToTray = !(this.config.minimizeToTray ?? true);
  }
  // [CUSTOM-STARTUP-END]

  async setBase44ApiKey(apiKey?: string) {
    if (!this.config.outputVendors.json) {
      this.config.outputVendors.json = {
        active: true,
        options: { filePath: '', base44ApiKey: apiKey ?? '' },
      } as unknown as Config['outputVendors']['json'];
      return;
    }
    this.config.outputVendors.json.options.base44ApiKey = apiKey ?? '';
  }

  async setBase44UserUuid(userUuid?: string) {
    const normalized = (userUuid ?? '').trim();
    if (!this.config.outputVendors.json) {
      this.config.outputVendors.json = {
        active: true,
        options: { filePath: '', base44UserUuid: normalized },
      } as unknown as Config['outputVendors']['json'];
      return;
    }
    this.config.outputVendors.json.options.base44UserUuid = normalized;
  }
  // [CUSTOM-BASE44-END]

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
