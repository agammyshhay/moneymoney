import { type AccountToScrapeConfig, type CompanyTypes } from '../types';
import { type SyncHistoryEntry } from '../store/ConfigStore';
import { describeError } from './errorMessages';
import { getBankDisplayName } from './hebrewFormat';

export const CONSECUTIVE_FAILURE_THRESHOLD = 3;
export const STALE_DAYS_THRESHOLD = 7;

export type WarningSeverity = 'critical' | 'warning';

export type WarningKind = 'credentials' | 'blocked' | 'two_factor' | 'consecutive' | 'stale';

export interface AccountWarning {
  accountId: string;
  vendorId: CompanyTypes;
  severity: WarningSeverity;
  kind: WarningKind;
  title: string;
  hint?: string;
  consecutiveFailures: number;
  daysSinceLastSuccess?: number;
  lastErrorType?: string;
  lastErrorMessage?: string;
}

type Outcome = 'success' | 'failure' | 'not_attempted';

const classify = (entry: SyncHistoryEntry, vendorId: CompanyTypes): Outcome => {
  if (entry.successfulVendors?.includes(vendorId)) return 'success';
  // Backward-compat: entries written before `successfulVendors` existed only signal success
  // via newTransactions. A successful sync with zero new transactions in those entries cannot
  // be distinguished from "not attempted" — that is the bug `successfulVendors` was added to fix.
  const successInEntry = Object.values(entry.newTransactions ?? {}).some((tx) => tx.vendorId === vendorId);
  if (successInEntry) return 'success';
  const failureInEntry = (entry.errors ?? []).some((err) => err.vendorId === vendorId);
  if (failureInEntry) return 'failure';
  return 'not_attempted';
};

const findLatestError = (
  history: SyncHistoryEntry[],
  vendorId: CompanyTypes,
): { errorType?: string; message?: string } | undefined => {
  for (const entry of history) {
    const err = (entry.errors ?? []).find((e) => e.vendorId === vendorId);
    if (err) return { errorType: err.errorType, message: err.message };
  }
  return undefined;
};

const buildWarning = (
  account: AccountToScrapeConfig,
  consecutiveFailures: number,
  daysSinceLastSuccess: number | undefined,
  latestError: { errorType?: string; message?: string } | undefined,
): AccountWarning | null => {
  // If the most recent attempt for this account succeeded, suppress all warnings —
  // older error types in history are stale signals.
  if (consecutiveFailures === 0) return null;

  const errorType = latestError?.errorType;
  const errorMessage = latestError?.message;

  const base = {
    accountId: account.id,
    vendorId: account.key,
    consecutiveFailures,
    daysSinceLastSuccess,
    lastErrorType: errorType,
    lastErrorMessage: errorMessage,
  };

  if (errorType === 'INVALID_PASSWORD' || errorType === 'CHANGE_PASSWORD') {
    const friendly = describeError({ errorType, vendorId: account.key, rawMessage: errorMessage });
    return {
      ...base,
      severity: 'critical',
      kind: 'credentials',
      title: friendly.title,
      hint: friendly.hint,
    };
  }

  if (errorType === 'ACCOUNT_BLOCKED') {
    const friendly = describeError({ errorType, vendorId: account.key, rawMessage: errorMessage });
    return {
      ...base,
      severity: 'critical',
      kind: 'blocked',
      title: friendly.title,
      hint: friendly.hint,
    };
  }

  if (errorType === 'TWO_FACTOR_RETRIEVER_MISSING') {
    const friendly = describeError({ errorType, vendorId: account.key, rawMessage: errorMessage });
    return {
      ...base,
      severity: 'critical',
      kind: 'two_factor',
      title: friendly.title,
      hint: friendly.hint,
    };
  }

  const bank = getBankDisplayName(account.key) ?? 'החשבון';

  if (daysSinceLastSuccess !== undefined && daysSinceLastSuccess >= STALE_DAYS_THRESHOLD && consecutiveFailures > 0) {
    return {
      ...base,
      severity: 'critical',
      kind: 'stale',
      title: `${bank} לא סונכרן בהצלחה כבר ${daysSinceLastSuccess} ימים`,
      hint: 'היכנסו להגדרות החשבון ובדקו את פרטי ההתחברות',
    };
  }

  if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
    return {
      ...base,
      severity: 'warning',
      kind: 'consecutive',
      title: `${bank} נכשל ב־${consecutiveFailures} סנכרונים רצופים`,
      hint: 'בדקו שפרטי ההתחברות עדיין תקפים, או הריצו סנכרון ידני כדי לראות את השגיאה',
    };
  }

  return null;
};

const daysBetween = (laterIso: string, now: number): number => {
  const later = new Date(laterIso).getTime();
  if (Number.isNaN(later)) return 0;
  return Math.max(0, Math.floor((now - later) / 86_400_000));
};

export function deriveAccountWarnings(
  accounts: AccountToScrapeConfig[],
  syncHistory: SyncHistoryEntry[],
  now: number = Date.now(),
): AccountWarning[] {
  if (!accounts || accounts.length === 0 || !syncHistory || syncHistory.length === 0) return [];

  const warnings: AccountWarning[] = [];

  for (const account of accounts) {
    if (account.active === false) continue;

    let consecutiveFailures = 0;
    let lastSuccessIso: string | undefined;

    for (const entry of syncHistory) {
      const outcome = classify(entry, account.key);
      if (outcome === 'success') {
        lastSuccessIso = entry.date;
        break;
      }
      if (outcome === 'failure') {
        consecutiveFailures += 1;
      }
    }

    if (consecutiveFailures === 0) continue;

    const daysSinceLastSuccess = lastSuccessIso ? daysBetween(lastSuccessIso, now) : undefined;
    const latestError = findLatestError(syncHistory, account.key);

    const warning = buildWarning(account, consecutiveFailures, daysSinceLastSuccess, latestError);
    if (warning) warnings.push(warning);
  }

  warnings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return 0;
  });

  return warnings;
}
