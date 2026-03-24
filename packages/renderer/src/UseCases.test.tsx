/**
 * USE_CASES.md — Automated verification of core user scenarios.
 *
 * Tests are organized by the use case IDs from USE_CASES.md.
 * Scenarios requiring the real Electron runtime (UC#16–19, UC#22, UC#24) are
 * excluded — they must be verified manually with `yarn watch`.
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runInAction } from 'mobx';
import { type Config, CompanyTypes, AccountStatus, AccountType, OutputVendorName, type Importer } from './types';
import { configStore } from './store/ConfigStore';

// ── Mock #preload ────────────────────────────────────────────────────────────

const mockGetConfig = vi.fn<() => Promise<Config>>();
const mockScrape = vi.fn();
const mockUpdateConfig = vi.fn();
const mockOpenExternal = vi.fn();

vi.mock('#preload', () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...(args as [])),
  getAppInfo: vi.fn(() => Promise.resolve({ name: 'MoneyMoney', version: '1.0.0' })),
  updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
  scrape: (...args: unknown[]) => mockScrape(...args),
  openExternal: (...args: unknown[]) => mockOpenExternal(...args),
  openItem: vi.fn(),
  showSaveDialog: vi.fn(),
  testBase44Connection: vi.fn(),
  syncJsonToBase44: vi.fn(),
  getYnabAccountData: vi.fn(),
  checkForUpdate: vi.fn(),
  getUpdateStatus: vi.fn(() => Promise.resolve(null)),
  onUpdateStatus: vi.fn(),
  quitAndInstall: vi.fn(),
  getLogsInfo: vi.fn(() => Promise.resolve({ logsFolder: '/tmp/logs' })),
  electronGoogleOAuth2Connector: vi.fn(),
  createSpreadsheet: vi.fn(),
  getAllUserSpreadsheets: vi.fn(),
  validateToken: vi.fn(),
  stopPeriodicScraping: vi.fn(),
  downloadUpdate: vi.fn(),
}));

import App from './components/App';

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseConfig: Config = {
  scraping: {
    numDaysBack: 30,
    showBrowser: false,
    accountsToScrape: [],
    timeout: 60000,
  },
  outputVendors: {
    json: {
      active: true,
      options: { filePath: 'transactions.json' },
    },
  },
};

const withAccounts = (...accounts: Config['scraping']['accountsToScrape']): Config => ({
  ...baseConfig,
  scraping: { ...baseConfig.scraping, accountsToScrape: accounts.flat() },
});

const hapoalimAccount = {
  id: 'acc-hapoalim',
  active: true,
  key: CompanyTypes.HAPOALIM,
  name: 'הפועלים',
  loginFields: { userCode: '12345', password: 'pass' },
};

const discountAccount = {
  id: 'acc-discount',
  active: true,
  key: CompanyTypes.DISCOUNT,
  name: 'דיסקונט',
  loginFields: { id: '111', password: 'pass', num: 'LY999' },
};

const populatedConfig: Config = {
  ...withAccounts(hapoalimAccount),
  outputVendors: {
    json: {
      active: true,
      options: {
        filePath: 'transactions.json',
        base44UserUuid: 'some-uuid',
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  runInAction(() => {
    configStore.configLoaded = false;
    configStore.config = {} as Config;
    configStore.accountScrapingData = new Map();
    configStore.chromeDownloadPercent = 0;
    configStore.showSummaryModal = false;
    configStore.lastScrapeSummary = { newTransactions: new Map(), errors: [], hasRun: false };
    configStore.syncHistory = [];
    configStore.nextAutomaticScrapeDate = null;
  });
  mockGetConfig.mockRejectedValue(new Error('default mock'));
});

afterEach(() => {
  cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #1 — First Run (empty state)
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#1 — First run (empty state)', () => {
  it('shows the wizard when no accounts exist', async () => {
    mockGetConfig.mockResolvedValue(baseConfig);
    render(<App />);

    const welcomeElements = await screen.findAllByText(/ברוכים הבאים/);
    expect(welcomeElements.length).toBeGreaterThan(0);
  });

  it('does NOT auto-sync while wizard is showing', async () => {
    mockGetConfig.mockResolvedValue(baseConfig);
    render(<App />);
    await screen.findAllByText(/ברוכים הבאים/);

    expect(mockScrape).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #2 — Add bank account (store-level)
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#2 — Add bank account', () => {
  it('adds an importer to config', () => {
    runInAction(() => configStore.updateConfig(baseConfig));
    expect(configStore.importers).toHaveLength(0);

    const newImporter: Importer = {
      id: 'new-acc',
      companyId: CompanyTypes.HAPOALIM,
      displayName: 'הפועלים',
      loginFields: { userCode: '12345', password: 'pass' },
      logo: '',
      logs: [],
      type: AccountType.IMPORTER,
      active: true,
    };
    configStore.addImporter(newImporter);

    expect(configStore.importers).toHaveLength(1);
    expect(configStore.importers[0].companyId).toBe(CompanyTypes.HAPOALIM);
  });

  it('account card appears in UI after adding', async () => {
    const configWith1 = withAccounts(hapoalimAccount);
    mockGetConfig.mockResolvedValue(configWith1);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('הפועלים')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #3 — Edit bank account (store-level)
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#3 — Edit bank account', () => {
  it('updates importer login fields', () => {
    runInAction(() => configStore.updateConfig(withAccounts(hapoalimAccount)));

    const importer = configStore.importers[0];
    configStore.updateImporter(importer.id, {
      ...importer,
      loginFields: { userCode: '99999', password: 'newpass' },
    });

    expect(configStore.config.scraping.accountsToScrape[0].loginFields).toEqual({
      userCode: '99999',
      password: 'newpass',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #4 — Delete bank account
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#4 — Delete bank account', () => {
  it('removes account from config', () => {
    runInAction(() => configStore.updateConfig(withAccounts(hapoalimAccount, discountAccount)));
    expect(configStore.importers).toHaveLength(2);

    configStore.deleteImporter('acc-hapoalim');

    expect(configStore.importers).toHaveLength(1);
    expect(configStore.importers[0].companyId).toBe(CompanyTypes.DISCOUNT);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #5 — Enable/disable account
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#5 — Enable/disable account', () => {
  it('toggling active flag updates the importer', () => {
    runInAction(() => configStore.updateConfig(withAccounts(hapoalimAccount)));
    expect(configStore.importers[0].active).toBe(true);

    const importer = configStore.importers[0];
    configStore.updateImporter(importer.id, { ...importer, active: false });

    expect(configStore.importers[0].active).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #6 — Run full sync
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#6 — Run full sync', () => {
  it('auto-scrapes on load for returning user', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(mockScrape).toHaveBeenCalled();
    });
  });

  it('shows sync button and accounts section', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
      expect(screen.getByText('בנקים וכרטיסי אשראי')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #7 — Run single account (store-level)
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#7 — Run single account', () => {
  it('clearAccountScrapingData resets only one account', () => {
    runInAction(() => {
      configStore.updateConfig(withAccounts(hapoalimAccount, discountAccount));
      configStore.accountScrapingData.set(CompanyTypes.HAPOALIM, {
        logs: [{ message: 'test' }],
        status: AccountStatus.DONE,
      });
      configStore.accountScrapingData.set(CompanyTypes.DISCOUNT, {
        logs: [{ message: 'test2' }],
        status: AccountStatus.DONE,
      });
    });

    configStore.clearAccountScrapingData(CompanyTypes.HAPOALIM);

    expect(configStore.accountScrapingData.has(CompanyTypes.HAPOALIM)).toBe(false);
    expect(configStore.accountScrapingData.has(CompanyTypes.DISCOUNT)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #8 — View sync summary
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#8 — Sync summary modal', () => {
  it('EXPORT_PROCESS_END triggers summary modal', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: new Date(),
    } as never);

    expect(configStore.showSummaryModal).toBe(false);

    configStore.handleScrapingEvent('EXPORT_PROCESS_END');
    expect(configStore.showSummaryModal).toBe(true);
  });

  it('accumulates new transaction counts from EXPORTER_END', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: new Date(),
    } as never);

    configStore.handleScrapingEvent('EXPORTER_END', {
      message: 'done',
      vendorId: OutputVendorName.JSON,
      accountStatus: AccountStatus.DONE,
      newTransactions: [
        { accountNumber: '1234', date: '', chargedAmount: 100, description: 'Test' },
        { accountNumber: '1234', date: '', chargedAmount: 200, description: 'Test2' },
        { accountNumber: '5678', date: '', chargedAmount: 50, description: 'Test3' },
      ],
    } as never);

    expect(configStore.lastScrapeSummary.newTransactions.get('1234')).toBe(2);
    expect(configStore.lastScrapeSummary.newTransactions.get('5678')).toBe(1);
  });

  it('shows success state in summary modal when no errors', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
    });

    // Simulate scrape completing with no errors
    runInAction(() => {
      configStore.lastScrapeSummary = {
        newTransactions: new Map([['1234', 3]]),
        errors: [],
        hasRun: true,
      };
      configStore.showSummaryModal = true;
    });

    await waitFor(() => {
      expect(screen.getByText('הסנכרון הסתיים בהצלחה')).toBeInTheDocument();
    });
  });

  it('shows error state in summary modal when errors exist', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
    });

    runInAction(() => {
      configStore.lastScrapeSummary = {
        newTransactions: new Map(),
        errors: [{ message: 'Login failed' }],
        hasRun: true,
      };
      configStore.showSummaryModal = true;
    });

    await waitFor(() => {
      expect(screen.getByText('ארעה שגיאה בסנכרון')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #9 — View sync history
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#9 — Sync history', () => {
  it('addSyncHistoryEntry records the latest scrape results', () => {
    runInAction(() => {
      configStore.updateConfig(populatedConfig);
      configStore.lastScrapeSummary = {
        newTransactions: new Map([
          ['1234', 5],
          ['5678', 2],
        ]),
        errors: [],
        hasRun: true,
      };
    });

    configStore.addSyncHistoryEntry();

    expect(configStore.syncHistory).toHaveLength(1);
    expect(configStore.syncHistory[0].newTransactions).toEqual({ '1234': 5, '5678': 2 });
    expect(configStore.syncHistory[0].success).toBe(true);
  });

  it('keeps at most 10 history entries', () => {
    runInAction(() => {
      configStore.updateConfig(populatedConfig);
      configStore.lastScrapeSummary = {
        newTransactions: new Map(),
        errors: [],
        hasRun: true,
      };
    });

    for (let i = 0; i < 15; i++) {
      configStore.addSyncHistoryEntry();
    }

    expect(configStore.syncHistory).toHaveLength(10);
  });

  it('records errors in history entries', () => {
    runInAction(() => {
      configStore.updateConfig(populatedConfig);
      configStore.lastScrapeSummary = {
        newTransactions: new Map(),
        errors: [{ message: 'Login failed', originalEvent: { vendorId: CompanyTypes.HAPOALIM } as never }],
        hasRun: true,
      };
    });

    configStore.addSyncHistoryEntry();

    expect(configStore.syncHistory[0].success).toBe(false);
    expect(configStore.syncHistory[0].errors).toHaveLength(1);
    expect(configStore.syncHistory[0].errors[0].message).toBe('Login failed');
  });

  it('renders history panel when entries exist', async () => {
    runInAction(() => {
      configStore.syncHistory = [
        {
          date: new Date().toISOString(),
          newTransactions: { '1234': 3 },
          errors: [],
          success: true,
        },
      ];
    });
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('היסטוריה')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #10 — Clear sync history
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#10 — Clear sync history', () => {
  it('clearSyncHistory removes all entries', () => {
    runInAction(() => {
      configStore.syncHistory = [
        { date: new Date().toISOString(), newTransactions: {}, errors: [], success: true },
        { date: new Date().toISOString(), newTransactions: {}, errors: [], success: true },
      ];
    });

    configStore.clearSyncHistory();

    expect(configStore.syncHistory).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #11 — View account logs
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#11 — Account logs', () => {
  it('handleScrapingEvent accumulates logs per account', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORTER_START', {
      message: 'Scraping הפועלים',
      vendorId: CompanyTypes.HAPOALIM,
      accountStatus: AccountStatus.IN_PROGRESS,
    } as never);

    configStore.handleScrapingEvent('IMPORTER_END', {
      message: 'Done scraping הפועלים',
      vendorId: CompanyTypes.HAPOALIM,
      accountStatus: AccountStatus.DONE,
    } as never);

    const data = configStore.accountScrapingData.get(CompanyTypes.HAPOALIM);
    expect(data).toBeDefined();
    expect(data!.logs).toHaveLength(2);
    expect(data!.logs[0].message).toBe('Scraping הפועלים');
    expect(data!.status).toBe(AccountStatus.DONE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #12 — Set MoneyMoney UUID
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#12 — MoneyMoney Base44 UUID', () => {
  it('setBase44UserUuid stores trimmed UUID', async () => {
    runInAction(() => configStore.updateConfig(baseConfig));

    await configStore.setBase44UserUuid('  my-uuid-123  ');

    expect(configStore.config.outputVendors.json!.options.base44UserUuid).toBe('my-uuid-123');
  });

  it('UUID persists after config round-trip', async () => {
    runInAction(() => configStore.updateConfig(baseConfig));
    await configStore.setBase44UserUuid('persistent-uuid');

    // Simulate re-reading config (as if restarting app)
    const savedConfig = JSON.parse(JSON.stringify(configStore.config));
    runInAction(() => configStore.updateConfig(savedConfig));

    expect(configStore.config.outputVendors.json!.options.base44UserUuid).toBe('persistent-uuid');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #20 — Periodic auto-sync scheduling
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#20 — Periodic auto-sync', () => {
  it('IMPORT_PROCESS_START sets nextAutomaticScrapeDate', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    const nextDate = new Date(Date.now() + 7200000); // 2 hours from now
    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: nextDate,
    } as never);

    expect(configStore.nextAutomaticScrapeDate).toEqual(nextDate);
  });

  it('setPeriodicScrapingIntervalHours clears next date when set to 0', () => {
    runInAction(() => {
      configStore.updateConfig(populatedConfig);
      configStore.nextAutomaticScrapeDate = new Date();
    });

    configStore.setPeriodicScrapingIntervalHours(0);

    expect(configStore.nextAutomaticScrapeDate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #23 — Security info modal
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#23 — Security info', () => {
  it('renders security button in top bar', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('איך המידע שלי נשמר?')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE #24 — Chrome download progress
// ═══════════════════════════════════════════════════════════════════════════════
describe('UC#24 — Chrome download progress', () => {
  it('shows progress bar when chromeDownloadPercent > 0', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
    });

    runInAction(() => {
      configStore.chromeDownloadPercent = 45;
    });

    await waitFor(() => {
      expect(screen.getByText(/מוריד כרום/)).toBeInTheDocument();
    });
  });

  it('hides progress bar when chromeDownloadPercent is 0', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
    });

    // percent stays 0 (default) → no progress bar
    expect(screen.queryByText(/מוריד כרום/)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

describe('E1 — Scrape fails (bad credentials)', () => {
  it('error event sets account status to error and logs the message', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORTER_END', {
      message: 'Login failed for הפועלים',
      vendorId: CompanyTypes.HAPOALIM,
      accountStatus: AccountStatus.ERROR,
      error: true,
    } as never);

    const data = configStore.accountScrapingData.get(CompanyTypes.HAPOALIM);
    expect(data!.status).toBe(AccountStatus.ERROR);
    expect(data!.logs[0].message).toBe('Login failed for הפועלים');
  });

  it('error is captured in lastScrapeSummary', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: new Date(),
    } as never);

    configStore.handleScrapingEvent('IMPORTER_END', {
      message: 'Login failed',
      vendorId: CompanyTypes.HAPOALIM,
      accountStatus: AccountStatus.ERROR,
      error: true,
    } as never);

    expect(configStore.lastScrapeSummary.errors).toHaveLength(1);
    expect(configStore.lastScrapeSummary.errors[0].message).toBe('Login failed');
  });
});

describe('E2 — Scrape timeout', () => {
  it('timeout error sets account status and logs correctly', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORTER_END', {
      message: 'Timeout exceeded for הפועלים',
      vendorId: CompanyTypes.HAPOALIM,
      accountStatus: AccountStatus.ERROR,
      error: true,
    } as never);

    const data = configStore.accountScrapingData.get(CompanyTypes.HAPOALIM);
    expect(data!.status).toBe(AccountStatus.ERROR);
    expect(configStore.lastScrapeSummary.errors).toHaveLength(1);
  });
});

describe('E4 — Base44 UUID not set', () => {
  it('config without UUID does not crash sync flow', () => {
    const configNoUuid: Config = {
      ...withAccounts(hapoalimAccount),
      outputVendors: {
        json: {
          active: true,
          options: { filePath: 'transactions.json' },
          // no base44UserUuid
        },
      },
    };
    runInAction(() => configStore.updateConfig(configNoUuid));

    // Simulate full scrape cycle — should not throw
    expect(() => {
      configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
        message: 'start',
        nextAutomaticScrapeDate: new Date(),
      } as never);
      configStore.handleScrapingEvent('EXPORTER_END', {
        message: 'JSON export done',
        vendorId: OutputVendorName.JSON,
        accountStatus: AccountStatus.DONE,
        newTransactions: [{ accountNumber: '1234', date: '', chargedAmount: 100, description: 'T' }],
      } as never);
      configStore.handleScrapingEvent('EXPORT_PROCESS_END');
    }).not.toThrow();

    expect(configStore.showSummaryModal).toBe(true);
  });
});

describe('E5 — No active accounts', () => {
  it('sync completes with empty summary when no accounts configured', () => {
    runInAction(() => configStore.updateConfig(baseConfig));

    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: new Date(),
    } as never);
    configStore.handleScrapingEvent('EXPORT_PROCESS_END');

    expect(configStore.showSummaryModal).toBe(true);
    expect(configStore.lastScrapeSummary.newTransactions.size).toBe(0);
    expect(configStore.lastScrapeSummary.errors).toHaveLength(0);
  });
});

describe('E6 — No internet (scrape fails)', () => {
  it('GENERAL_ERROR triggers summary modal with error', () => {
    runInAction(() => configStore.updateConfig(populatedConfig));

    configStore.handleScrapingEvent('IMPORT_PROCESS_START', {
      message: 'start',
      nextAutomaticScrapeDate: new Date(),
    } as never);

    configStore.handleScrapingEvent('GENERAL_ERROR', {
      message: 'Network error: cannot reach bank server',
      error: true,
    } as never);

    expect(configStore.showSummaryModal).toBe(true);
    expect(configStore.lastScrapeSummary.errors).toHaveLength(1);
  });
});

describe('E7 — Corrupted/missing config', () => {
  it('getConfig rejection shows wizard instead of blank screen', async () => {
    // Default mock rejects — simulates SALT error
    render(<App />);

    const welcomeElements = await screen.findAllByText(/ברוכים הבאים/);
    expect(welcomeElements.length).toBeGreaterThan(0);
  });

  it('does NOT auto-sync when config is broken', async () => {
    render(<App />);
    await screen.findAllByText(/ברוכים הבאים/);

    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('isFirstRun returns true for empty loaded config', () => {
    runInAction(() => {
      configStore.configLoaded = true;
      configStore.config = {} as Config;
    });
    expect(configStore.isFirstRun).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isFirstRun edge cases (supports UC#1 + E7)
// ═══════════════════════════════════════════════════════════════════════════════
describe('isFirstRun edge cases', () => {
  it('returns false when UUID set but no accounts', () => {
    runInAction(() =>
      configStore.updateConfig({
        ...baseConfig,
        outputVendors: {
          json: { active: true, options: { filePath: 'f.json', base44UserUuid: 'uuid' } },
        },
      }),
    );
    expect(configStore.isFirstRun).toBe(false);
  });

  it('returns false when accounts exist but no UUID', () => {
    runInAction(() => configStore.updateConfig(withAccounts(hapoalimAccount)));
    expect(configStore.isFirstRun).toBe(false);
  });
});
