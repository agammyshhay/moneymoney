import { describe, test, expect } from 'vitest';
import { CONSECUTIVE_FAILURE_THRESHOLD, STALE_DAYS_THRESHOLD, deriveAccountWarnings } from './accountHealth';
import { type AccountToScrapeConfig, CompanyTypes } from '../types';
import { type SyncHistoryEntry } from '../store/ConfigStore';

const account: AccountToScrapeConfig = {
  id: 'acct-1',
  key: CompanyTypes.HAPOALIM,
  name: 'בנק הפועלים',
  loginFields: {},
  active: true,
};

const failureEntry = (
  date: string,
  errorType?: string,
  vendorId: CompanyTypes = CompanyTypes.HAPOALIM,
): SyncHistoryEntry => ({
  date,
  newTransactions: {},
  errors: [{ message: 'fail', vendorId, errorType }],
  status: 'failed',
  accountsAttempted: 1,
  accountsSucceeded: 0,
});

const successEntry = (date: string, vendorId: CompanyTypes = CompanyTypes.HAPOALIM): SyncHistoryEntry => ({
  date,
  newTransactions: { '12345': { vendorId, count: 5 } },
  errors: [],
  status: 'success',
  accountsAttempted: 1,
  accountsSucceeded: 1,
  successfulVendors: [vendorId],
});

// Successful sync that returned zero new transactions — what the user sees right after
// fixing a bad password if the account was already up to date.
const emptySuccessEntry = (date: string, vendorId: CompanyTypes = CompanyTypes.HAPOALIM): SyncHistoryEntry => ({
  date,
  newTransactions: {},
  errors: [],
  status: 'success',
  accountsAttempted: 1,
  accountsSucceeded: 1,
  successfulVendors: [vendorId],
});

// Pre-`successfulVendors` entry shape — represents history written before the field was added.
const legacySuccessEntry = (date: string, vendorId: CompanyTypes = CompanyTypes.HAPOALIM): SyncHistoryEntry => ({
  date,
  newTransactions: { '12345': { vendorId, count: 5 } },
  errors: [],
  status: 'success',
  accountsAttempted: 1,
  accountsSucceeded: 1,
});

const NOW = new Date('2026-05-04T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('deriveAccountWarnings', () => {
  test('empty history → no warnings', () => {
    expect(deriveAccountWarnings([account], [], NOW)).toEqual([]);
  });

  test('account with no entries in history → no warning', () => {
    const otherAccount: AccountToScrapeConfig = { ...account, key: CompanyTypes.LEUMI };
    const history: SyncHistoryEntry[] = [successEntry(daysAgo(1))];
    expect(deriveAccountWarnings([otherAccount], history, NOW)).toEqual([]);
  });

  test('inactive accounts are skipped', () => {
    const inactive = { ...account, active: false };
    const history = [failureEntry(daysAgo(0), 'CHANGE_PASSWORD')];
    expect(deriveAccountWarnings([inactive], history, NOW)).toEqual([]);
  });

  test('CHANGE_PASSWORD on first failure → critical/credentials', () => {
    const history = [failureEntry(daysAgo(0), 'CHANGE_PASSWORD')];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('critical');
    expect(w.kind).toBe('credentials');
    expect(w.lastErrorType).toBe('CHANGE_PASSWORD');
    expect(w.title).toContain('סיסמה');
  });

  test('INVALID_PASSWORD → critical/credentials', () => {
    const history = [failureEntry(daysAgo(0), 'INVALID_PASSWORD')];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('critical');
    expect(w.kind).toBe('credentials');
  });

  test('ACCOUNT_BLOCKED → critical/blocked', () => {
    const history = [failureEntry(daysAgo(0), 'ACCOUNT_BLOCKED')];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('critical');
    expect(w.kind).toBe('blocked');
  });

  test('TWO_FACTOR_RETRIEVER_MISSING → critical/two_factor', () => {
    const history = [failureEntry(daysAgo(0), 'TWO_FACTOR_RETRIEVER_MISSING')];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('critical');
    expect(w.kind).toBe('two_factor');
  });

  test('N consecutive generic failures → warning/consecutive', () => {
    const history: SyncHistoryEntry[] = [];
    for (let i = 0; i < CONSECUTIVE_FAILURE_THRESHOLD; i += 1) {
      history.push(failureEntry(daysAgo(i), 'GENERIC'));
    }
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('warning');
    expect(w.kind).toBe('consecutive');
    expect(w.consecutiveFailures).toBe(CONSECUTIVE_FAILURE_THRESHOLD);
  });

  test('fewer than threshold consecutive generic failures → no warning', () => {
    const history = [failureEntry(daysAgo(0), 'GENERIC'), failureEntry(daysAgo(1), 'GENERIC')];
    expect(deriveAccountWarnings([account], history, NOW)).toEqual([]);
  });

  test('success in middle resets consecutive streak', () => {
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'GENERIC'),
      failureEntry(daysAgo(1), 'GENERIC'),
      successEntry(daysAgo(2)),
      failureEntry(daysAgo(3), 'GENERIC'),
      failureEntry(daysAgo(4), 'GENERIC'),
    ];
    expect(deriveAccountWarnings([account], history, NOW)).toEqual([]);
  });

  test('not-attempted entries do not count toward streak nor break it', () => {
    const otherVendorEntry = failureEntry(daysAgo(1), 'GENERIC', CompanyTypes.LEUMI);
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'GENERIC'),
      otherVendorEntry,
      failureEntry(daysAgo(2), 'GENERIC'),
      failureEntry(daysAgo(3), 'GENERIC'),
    ];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w?.kind).toBe('consecutive');
    expect(w?.consecutiveFailures).toBe(3);
  });

  test('stale: no success in >= STALE_DAYS_THRESHOLD with at least one failure → critical/stale', () => {
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'GENERIC'),
      successEntry(daysAgo(STALE_DAYS_THRESHOLD + 2)),
    ];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.severity).toBe('critical');
    expect(w.kind).toBe('stale');
    expect(w.daysSinceLastSuccess).toBeGreaterThanOrEqual(STALE_DAYS_THRESHOLD);
  });

  test('stale takes priority over consecutive when both apply', () => {
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'GENERIC'),
      failureEntry(daysAgo(1), 'GENERIC'),
      failureEntry(daysAgo(2), 'GENERIC'),
      failureEntry(daysAgo(3), 'GENERIC'),
      successEntry(daysAgo(STALE_DAYS_THRESHOLD + 5)),
    ];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.kind).toBe('stale');
    expect(w.severity).toBe('critical');
  });

  test('credentials error overrides stale/consecutive priority', () => {
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'CHANGE_PASSWORD'),
      failureEntry(daysAgo(1), 'GENERIC'),
      failureEntry(daysAgo(2), 'GENERIC'),
    ];
    const [w] = deriveAccountWarnings([account], history, NOW);
    expect(w.kind).toBe('credentials');
  });

  test('most recent sync was a success → no warning even with prior credential errors', () => {
    const history: SyncHistoryEntry[] = [
      successEntry(daysAgo(0)),
      failureEntry(daysAgo(1), 'CHANGE_PASSWORD'),
      failureEntry(daysAgo(2), 'INVALID_PASSWORD'),
    ];
    expect(deriveAccountWarnings([account], history, NOW)).toEqual([]);
  });

  test('successful sync with zero new transactions clears prior failures', () => {
    // Reproduces the user-reported bug: password fixed, sync succeeded, but no new transactions
    // were downloaded because the account was already up to date. Prior to the fix, the banner
    // persisted because the success was indistinguishable from "not attempted".
    const history: SyncHistoryEntry[] = [
      emptySuccessEntry(daysAgo(0)),
      failureEntry(daysAgo(1), 'INVALID_PASSWORD'),
      failureEntry(daysAgo(2), 'INVALID_PASSWORD'),
      failureEntry(daysAgo(3), 'INVALID_PASSWORD'),
    ];
    expect(deriveAccountWarnings([account], history, NOW)).toEqual([]);
  });

  test('legacy entry (pre-successfulVendors) still detected as success via newTransactions', () => {
    const history: SyncHistoryEntry[] = [
      legacySuccessEntry(daysAgo(0)),
      failureEntry(daysAgo(1), 'INVALID_PASSWORD'),
      failureEntry(daysAgo(2), 'INVALID_PASSWORD'),
      failureEntry(daysAgo(3), 'INVALID_PASSWORD'),
    ];
    expect(deriveAccountWarnings([account], history, NOW)).toEqual([]);
  });

  test('warnings are sorted critical-first', () => {
    const acctA: AccountToScrapeConfig = { ...account, id: 'a', key: CompanyTypes.HAPOALIM };
    const acctB: AccountToScrapeConfig = { ...account, id: 'b', key: CompanyTypes.LEUMI };
    const history: SyncHistoryEntry[] = [
      failureEntry(daysAgo(0), 'GENERIC', CompanyTypes.HAPOALIM),
      failureEntry(daysAgo(1), 'GENERIC', CompanyTypes.HAPOALIM),
      failureEntry(daysAgo(2), 'GENERIC', CompanyTypes.HAPOALIM),
      failureEntry(daysAgo(0), 'CHANGE_PASSWORD', CompanyTypes.LEUMI),
    ];
    const result = deriveAccountWarnings([acctA, acctB], history, NOW);
    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('critical');
    expect(result[1].severity).toBe('warning');
  });
});
