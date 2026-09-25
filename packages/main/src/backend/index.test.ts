import { describe, expect, test, vi } from 'vitest';

vi.mock('../logging/logger', () => ({
  default: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./configManager/configManager', () => ({}));
vi.mock('./export/outputVendors', () => ({ default: {} }));
vi.mock('@/backend/export/exportTransactions', () => ({ createTransactionsInExternalVendors: vi.fn() }));
vi.mock('@/backend/import/importTransactions', () => ({
  cancelScraping: vi.fn(),
  scrapeFinancialAccountsAndFetchTransactions: vi.fn(),
}));
vi.mock('./eventEmitters/EventEmitter', () => {
  class BudgetTrackingEventEmitter {
    emit = vi.fn();
  }
  return {
    BudgetTrackingEventEmitter,
    EventNames: {},
    ImportStartEvent: class {},
    BudgetTrackingEvent: class {},
  };
});

import { scrapeFinancialAccountsAndFetchTransactions } from '@/backend/import/importTransactions';
import { type Config } from './commonTypes';
import { scrapeAndUpdateOutputVendors } from './index';

const config = { scraping: { numDaysBack: 30 }, outputVendors: {} } as unknown as Config;

describe('scrapeAndUpdateOutputVendors', () => {
  test('ignores a second sync while one is running, and allows one after it finishes', async () => {
    let finishFirst!: () => void;
    vi.mocked(scrapeFinancialAccountsAndFetchTransactions)
      .mockImplementationOnce(() => new Promise((r) => (finishFirst = () => r({}))))
      .mockResolvedValue({});

    const first = scrapeAndUpdateOutputVendors(config);
    await scrapeAndUpdateOutputVendors(config);
    expect(scrapeFinancialAccountsAndFetchTransactions).toHaveBeenCalledTimes(1);

    finishFirst();
    await first;
    await scrapeAndUpdateOutputVendors(config);
    expect(scrapeFinancialAccountsAndFetchTransactions).toHaveBeenCalledTimes(2);
  });

  test('a failed sync releases the guard', async () => {
    vi.mocked(scrapeFinancialAccountsAndFetchTransactions).mockReset().mockRejectedValueOnce(new Error('boom'));

    await expect(scrapeAndUpdateOutputVendors(config)).rejects.toThrow('boom');
    vi.mocked(scrapeFinancialAccountsAndFetchTransactions).mockResolvedValue({});
    await scrapeAndUpdateOutputVendors(config);
    expect(scrapeFinancialAccountsAndFetchTransactions).toHaveBeenCalledTimes(2);
  });
});
