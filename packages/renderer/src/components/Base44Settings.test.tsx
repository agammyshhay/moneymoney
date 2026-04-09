import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Base44Settings from './Base44Settings';
import { ConfigStoreProvider, configStore } from '../store/ConfigStore';
import { type Config, OutputVendorName } from '../types';

// Mock the #preload module
vi.mock('#preload', () => ({
  showSaveDialog: vi.fn(),
  testBase44Connection: vi.fn(),
  syncJsonToBase44: vi.fn(),
  updateConfig: vi.fn(),
  hasBase44Token: vi.fn().mockResolvedValue(false),
  clearBase44Token: vi.fn().mockResolvedValue({ ok: true }),
  onBase44TokenReceived: vi.fn().mockReturnValue(vi.fn()),
  onBase44TokenExpired: vi.fn().mockReturnValue(vi.fn()),
  openExternal: vi.fn(),
  getBase44ConnectUrl: vi.fn().mockResolvedValue('https://moneym.base44.app/desktop-connect-code?state=test'),
}));

// Setup a dummy config for the store
const dummyConfig: Config = {
  outputVendors: {
    [OutputVendorName.JSON]: {
      active: true,
      options: {
        filePath: 'test.json',
      },
    },
  },
  scraping: {
    numDaysBack: 1,
    showBrowser: false,
    accountsToScrape: [],
    timeout: 60000,
  },
};

describe('Base44Settings', () => {
  it('renders Base44 settings header and connect button', async () => {
    // Initialize store with dummy config
    configStore.config = dummyConfig;

    render(
      <ConfigStoreProvider>
        <Base44Settings />
      </ConfigStoreProvider>,
    );

    // Wait for the async token check to complete
    await waitFor(() => {
      expect(screen.getByText(/חיבור ל-MoneyMoney/i)).toBeInTheDocument();
    });

    // User has no Bearer token, so the "not connected" state should show
    expect(screen.getByText(/לא מחובר/)).toBeInTheDocument();
  });
});
