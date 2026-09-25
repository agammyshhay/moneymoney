import { type Config } from '@/backend/commonTypes';
import { createTransactionsInExternalVendors } from '@/backend/export/exportTransactions';
import { cancelScraping, scrapeFinancialAccountsAndFetchTransactions } from '@/backend/import/importTransactions';
import moment from 'moment';
import * as configManager from './configManager/configManager';
import * as Events from './eventEmitters/EventEmitter';
import { EventNames } from './eventEmitters/EventEmitter';
import outputVendors from './export/outputVendors';
import logger from '../logging/logger';

export { CompanyTypes } from 'israeli-bank-scrapers-core';
export { cancelScraping, Events, configManager, outputVendors };

// Periodic sync is scheduled by the renderer (Body.tsx overdue check, based on lastScrapeDate).
// Kept as a no-op for the existing stopPeriodicScraping IPC.
export function stopPeriodicScraping() {
  // nothing to stop
}

// [CUSTOM-FIX-START] — Only one sync at a time. Overlapping runs log into the same banks
// concurrently and race on transaction.json.
let syncInProgress = false;

export async function scrapeAndUpdateOutputVendors(config: Config, optionalEventPublisher?: Events.EventPublisher) {
  if (syncInProgress) {
    logger.log('Sync already in progress, ignoring new sync request');
    return;
  }
  syncInProgress = true;
  try {
    return await runScrapeAndExport(config, optionalEventPublisher);
  } finally {
    syncInProgress = false;
  }
}
// [CUSTOM-FIX-END]

async function runScrapeAndExport(config: Config, optionalEventPublisher?: Events.EventPublisher) {
  const eventPublisher = optionalEventPublisher ?? new Events.BudgetTrackingEventEmitter();

  const startDate = moment().subtract(config.scraping.numDaysBack, 'days').startOf('day').toDate();

  const nextAutomaticScrapeDate: Date | null = config.scraping.periodicScrapingIntervalHours
    ? moment().add(config.scraping.periodicScrapingIntervalHours, 'hours').toDate()
    : null;

  await eventPublisher.emit(
    EventNames.IMPORT_PROCESS_START,
    new Events.ImportStartEvent(`Starting to scrape from ${startDate} to today`, nextAutomaticScrapeDate),
  );

  try {
    const companyIdToTransactions = await scrapeFinancialAccountsAndFetchTransactions(
      config.scraping,
      startDate,
      eventPublisher,
    );
    return await createTransactionsInExternalVendors(
      config.outputVendors,
      companyIdToTransactions,
      startDate,
      eventPublisher,
    );
  } catch (e) {
    logger.error('Scraping or export failed', e);
    const err = e as Error & { errorType?: string };
    await eventPublisher.emit(
      EventNames.GENERAL_ERROR,
      new Events.BudgetTrackingEvent({
        message: err.message,
        error: err,
        errorType: err.errorType,
      }),
    );
    throw e;
  }
}
