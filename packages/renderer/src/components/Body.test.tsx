/**
 * Integration tests for the release build bug fix + USE_CASES.md verification.
 *
 * Validates user scenarios that broke in v1.0.0 due to missing VITE_APP_NAME
 * in CI, plus core use cases from USE_CASES.md:
 *   UC#1  — First run (empty state): wizard shows, no auto-sync
 *   UC#6  — Returning user: auto-sync triggers
 *   E5    — No active accounts: sync completes without crash
 *   E7    — Corrupted/missing config: fallback, no crash
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runInAction } from 'mobx';
import { type Config, CompanyTypes } from '../types';
import { configStore } from '../store/ConfigStore';

// ── Mock #preload ────────────────────────────────────────────────────────────

const mockGetConfig = vi.fn<() => Promise<Config>>();
const mockScrape = vi.fn();

vi.mock('#preload', () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...(args as [])),
  getAppInfo: vi.fn(() => Promise.resolve({ name: 'MoneyMoney', version: '1.0.0' })),
  updateConfig: vi.fn(),
  scrape: (...args: unknown[]) => mockScrape(...args),
  openExternal: vi.fn(),
  openItem: vi.fn(),
  showSaveDialog: vi.fn(),
  testBase44Connection: vi.fn(),
  syncJsonToBase44: vi.fn(),
  getYnabAccountData: vi.fn(),
  checkForUpdate: vi.fn(),
  getUpdateStatus: vi.fn(() => Promise.resolve(null)),
  onUpdateStatus: vi.fn(),
  quitAndInstall: vi.fn(),
  getLogsInfo: vi.fn(() => Promise.resolve({ logsFolder: '/tmp' })),
  electronGoogleOAuth2Connector: vi.fn(),
  createSpreadsheet: vi.fn(),
  getAllUserSpreadsheets: vi.fn(),
  validateToken: vi.fn(),
  stopPeriodicScraping: vi.fn(),
  downloadUpdate: vi.fn(),
}));

import App from './App';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset singleton to blank state
  runInAction(() => {
    configStore.configLoaded = false;
    configStore.config = {} as Config;
    configStore.accountScrapingData = new Map();
    configStore.chromeDownloadPercent = 0;
    configStore.showSummaryModal = false;
  });
  // Default: getConfig rejects (simulates missing env var / broken config)
  mockGetConfig.mockRejectedValue(new Error('SALT not existed'));
});

afterEach(() => {
  cleanup();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Config that looks like a brand-new install (no accounts, no UUID). */
const emptyConfig: Config = {
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

/** Config for a returning user who already has accounts set up. */
const populatedConfig: Config = {
  scraping: {
    numDaysBack: 30,
    showBrowser: false,
    accountsToScrape: [
      {
        id: 'acc1',
        active: true,
        key: CompanyTypes.HAPOALIM,
        name: 'הפועלים',
        loginFields: { userCode: '12345', password: 'pass' },
      },
    ],
    timeout: 60000,
  },
  outputVendors: {
    json: {
      active: true,
      options: {
        filePath: 'transactions.json',
        base44UserUuid: 'some-uuid-value',
      },
    },
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('USE_CASES.md — UC#1: First run (empty state)', () => {
  it('shows the onboarding wizard when config has no accounts', async () => {
    mockGetConfig.mockResolvedValue(emptyConfig);

    render(<App />);

    // Wizard welcome text should appear
    const welcomeElements = await screen.findAllByText(/ברוכים הבאים/);
    expect(welcomeElements.length).toBeGreaterThan(0);

    // "Let's get started" button should be visible
    expect(screen.getAllByText(/בואו נתחיל/).length).toBeGreaterThan(0);

    // Skip button available as escape hatch
    expect(screen.getAllByText('דלג על ההגדרה').length).toBeGreaterThan(0);
  });

  it('does NOT auto-sync when wizard is showing', async () => {
    mockGetConfig.mockResolvedValue(emptyConfig);

    render(<App />);

    // Wait for wizard to appear (config loaded, wizard shown)
    await screen.findAllByText(/ברוכים הבאים/);

    // scrape() should NOT have been called — wizard suppresses auto-run
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('isFirstRun returns true for empty accounts and no UUID', () => {
    runInAction(() => {
      configStore.updateConfig(emptyConfig);
    });
    expect(configStore.isFirstRun).toBe(true);
  });
});

describe('USE_CASES.md — UC#6: Sync for returning user', () => {
  it('shows accounts section without wizard', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);

    render(<App />);

    // Wait for accounts section — proves config loaded
    await waitFor(() => {
      expect(screen.getByText('בנקים וכרטיסי אשראי')).toBeInTheDocument();
    });

    // Wizard should not be visible after config loads
    await waitFor(() => {
      expect(screen.queryByText(/ברוכים הבאים/)).not.toBeInTheDocument();
    });

    // Sync button should be present (may already be in "running" state from auto-scrape)
    expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
  });

  it('triggers auto-sync on load for returning user', async () => {
    mockGetConfig.mockResolvedValue(populatedConfig);

    render(<App />);

    // Wait for config to load and auto-run to trigger
    await waitFor(() => {
      expect(mockScrape).toHaveBeenCalled();
    });

    // Verify scrape was called with the populated config (has accounts)
    const callArgs = mockScrape.mock.calls[0];
    expect(callArgs[1]).toMatchObject({
      scraping: {
        accountsToScrape: expect.arrayContaining([expect.objectContaining({ key: CompanyTypes.HAPOALIM })]),
      },
    });
  });

  it('isFirstRun returns false when accounts exist', () => {
    runInAction(() => {
      configStore.updateConfig(populatedConfig);
    });
    expect(configStore.isFirstRun).toBe(false);
  });
});

describe('USE_CASES.md — E5: No active accounts', () => {
  it('renders sync button even with zero accounts', async () => {
    // Config with scraping section but empty accounts — not a "first run" if UUID is set
    const noAccountsWithUuid: Config = {
      ...emptyConfig,
      outputVendors: {
        json: {
          active: true,
          options: {
            filePath: 'transactions.json',
            base44UserUuid: 'existing-uuid',
          },
        },
      },
    };
    mockGetConfig.mockResolvedValue(noAccountsWithUuid);

    render(<App />);

    // Sync button should be present (may already be in "running" state from auto-scrape)
    await waitFor(() => {
      expect(screen.getByText(/הפעל סנכרון|עצור סנכרון/)).toBeInTheDocument();
    });
  });
});

describe('USE_CASES.md — E7: Corrupted/missing config file', () => {
  it('shows wizard instead of blank screen when getConfig rejects', async () => {
    // Default mock: getConfig rejects with SALT error
    // This simulates the exact v1.0.0 bug: missing VITE_APP_NAME → keytar fails

    render(<App />);

    // Wizard should appear (not a blank screen)
    const welcomeElements = await screen.findAllByText(/ברוכים הבאים/);
    expect(welcomeElements.length).toBeGreaterThan(0);
  });

  it('does NOT auto-sync when config is broken', async () => {
    // getConfig rejects (default mock)
    render(<App />);

    // Wait for the error to be caught
    await screen.findAllByText(/ברוכים הבאים/);

    // scrape() should NOT have been called
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('isFirstRun returns true when config has no scraping property', () => {
    runInAction(() => {
      configStore.configLoaded = true;
      configStore.config = {} as Config;
    });
    expect(configStore.isFirstRun).toBe(true);
  });
});

describe('isFirstRun edge cases', () => {
  it('returns false when no accounts but UUID is set (user connected MoneyMoney)', () => {
    const configWithUuidOnly: Config = {
      ...emptyConfig,
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
    runInAction(() => {
      configStore.updateConfig(configWithUuidOnly);
    });
    // noAccounts=true, noUuid=false → false (UUID counts as setup progress)
    expect(configStore.isFirstRun).toBe(false);
  });

  it('returns false when accounts exist but no UUID', () => {
    const configWithAccountsOnly: Config = {
      ...populatedConfig,
      outputVendors: {
        json: {
          active: true,
          options: { filePath: 'transactions.json' },
        },
      },
    };
    runInAction(() => {
      configStore.updateConfig(configWithAccountsOnly);
    });
    // noAccounts=false, noUuid=true → false (accounts exist, UUID optional)
    expect(configStore.isFirstRun).toBe(false);
  });
});
