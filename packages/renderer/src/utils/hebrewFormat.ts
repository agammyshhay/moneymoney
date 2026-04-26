import accountMetadata from '../accountMetadata';
import { type CompanyTypes, type OutputVendorName } from '../types';

type VendorId = CompanyTypes | OutputVendorName | string | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

const isToday = (d: Date) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const isYesterday = (d: Date) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
};

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דקות`;

  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (isToday(d)) return `היום ב־${hhmm}`;
  if (isYesterday(d)) return `אתמול ב־${hhmm}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24 * 7) {
    const days = Math.floor(hours / 24);
    return `לפני ${days} ימים`;
  }

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getBankDisplayName(vendorId: VendorId): string | undefined {
  if (!vendorId) return undefined;
  const meta = accountMetadata[vendorId as CompanyTypes | OutputVendorName];
  return meta?.companyName;
}

/**
 * Returns "{Hebrew bank name} · ...{last4}" when both pieces are available,
 * "{Hebrew bank name}" when only the bank is known,
 * and "חשבון {accountNumber}" as a fallback.
 */
export function formatAccountLabel(vendorId: VendorId, accountNumber?: string): string {
  const bank = getBankDisplayName(vendorId);
  const last4 = accountNumber && accountNumber.length >= 4 ? accountNumber.slice(-4) : accountNumber;
  if (bank && last4) return `${bank} · ...${last4}`;
  if (bank) return bank;
  if (accountNumber) return `חשבון ${accountNumber}`;
  return 'חשבון לא ידוע';
}

interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  many: string;
}

/**
 * Hebrew-aware plural picker.
 * - 0  → zero (or many when not provided)
 * - 1  → one
 * - 2  → two (or many when not provided)
 * - n  → many
 * The returned string can include "{n}" which will be replaced with the actual number.
 */
export function pluralize(n: number, forms: PluralForms): string {
  let template: string;
  if (n === 0 && forms.zero) template = forms.zero;
  else if (n === 1) template = forms.one;
  else if (n === 2 && forms.two) template = forms.two;
  else template = forms.many;
  return template.replace('{n}', String(n));
}

export const transactionsPlural = (n: number) =>
  pluralize(n, {
    zero: 'אין תנועות חדשות',
    one: 'תנועה חדשה אחת',
    two: 'שתי תנועות חדשות',
    many: '{n} תנועות חדשות',
  });

export const errorsPlural = (n: number) =>
  pluralize(n, {
    one: 'שגיאה אחת',
    two: 'שתי שגיאות',
    many: '{n} שגיאות',
  });

export const accountsPlural = (n: number) =>
  pluralize(n, {
    zero: 'אף חשבון',
    one: 'חשבון אחד',
    two: 'שני חשבונות',
    many: '{n} חשבונות',
  });
