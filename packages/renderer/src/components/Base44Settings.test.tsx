import { render, screen } from '@testing-library/react';
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
}));

// Setup a dummy config for the store
const dummyConfig: Config = {
  outputVendors: {
    [OutputVendorName.JSON]: {
      active: true,
      options: {
        filePath: 'test.json',
        base44Url: 'https://test.base44.com',
        base44ApiKey: 'secret-key',
        base44UserUuid: 'user-uuid',
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
  it('renders Base44 settings inputs correctly', () => {
    // Initialize store with dummy config
    configStore.config = dummyConfig;

    render(
      <ConfigStoreProvider>
        <Base44Settings />
      </ConfigStoreProvider>,
    );

    // Check if the inputs are rendered with correct values
    expect(screen.getByDisplayValue('user-uuid')).toBeInTheDocument();

    // Check for labels (searching by text content)
    expect(screen.getByText(/קוד חיבור ל-MoneyMoney/i)).toBeInTheDocument();
  });
});
