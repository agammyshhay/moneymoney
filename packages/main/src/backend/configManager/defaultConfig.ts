import { type Config } from '../commonTypes';

const DEFAULT_CONFIG: Config = {
  scraping: {
    numDaysBack: 90,
    showBrowser: false,
    accountsToScrape: [],
    timeout: 72000,
    maxConcurrency: 6,
  },
  outputVendors: {
    csv: {
      active: false,
      options: {
        filePath: 'transaction.csv',
      },
    },
    json: {
      active: true,
      options: {
        filePath: 'transaction.json',
        base44Url: '',
        base44ApiKey: '',
        base44UserUuid: '',
      },
    },
    ynab: {
      active: false,
      options: {
        accessToken: 'YNAB_ACCESS_TOKEN_GOES_HERE',
        budgetId: '',
        accountNumbersToYnabAccountIds: {},
      },
    },
    googleSheets: {
      active: false,
      options: {
        credentials: {},
        spreadsheetId: '',
      },
    },
  },
};

export default DEFAULT_CONFIG;
