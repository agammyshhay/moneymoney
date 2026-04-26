import { OutputVendorName } from '../types';
import { getBankDisplayName } from './hebrewFormat';

export interface FriendlyError {
  title: string;
  hint?: string;
}

interface DescribeErrorInput {
  errorType?: string;
  vendorId?: string;
  rawMessage?: string;
}

const isExporter = (vendorId?: string): boolean =>
  !!vendorId && (Object.values(OutputVendorName) as string[]).includes(vendorId);

const looksLikeNetworkError = (raw?: string): boolean => {
  if (!raw) return false;
  return /ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|fetch failed|getaddrinfo|network/i.test(raw);
};

const looksLikeAuthError = (raw?: string): boolean => {
  if (!raw) return false;
  return /\b(401|403|unauthor|forbidden|invalid token|expired token)\b/i.test(raw);
};

/**
 * Maps raw scraper / exporter errors to friendly Hebrew text.
 * The {bank} placeholder is replaced with the Hebrew bank name (or
 * "החשבון" as a neutral fallback).
 */
export function describeError({ errorType, vendorId, rawMessage }: DescribeErrorInput): FriendlyError {
  const bank = getBankDisplayName(vendorId) ?? 'החשבון';
  const fill = (s: string) => s.replace('{bank}', bank);

  // Exporter / Base44 categories
  const isExporterError =
    isExporter(vendorId) || errorType?.startsWith('BASE44_') === true || errorType?.startsWith('EXPORT_') === true;
  if (isExporterError) {
    if (errorType === 'BASE44_AUTH' || looksLikeAuthError(rawMessage)) {
      return {
        title: 'החיבור ל־MoneyMoney פג תוקף',
        hint: 'התחבר מחדש מהגדרות החיבור',
      };
    }
    if (errorType === 'BASE44_NETWORK' || looksLikeNetworkError(rawMessage)) {
      return {
        title: 'לא הצלחנו לשלוח את הנתונים ל־MoneyMoney',
        hint: 'בדוק את חיבור האינטרנט ונסה שוב',
      };
    }
    return {
      title: 'תקלה בשמירת הנתונים',
      hint: 'נסה שוב, ואם זה חוזר — בדוק את ההגדרות של היעד',
    };
  }

  // Scraper categories (israeli-bank-scrapers-core ScraperErrorTypes)
  switch (errorType) {
    case 'INVALID_PASSWORD':
      return {
        title: fill('שם משתמש או סיסמה שגויים ב{bank}'),
        hint: 'עדכן את פרטי ההתחברות בהגדרות החשבון',
      };
    case 'CHANGE_PASSWORD':
      return {
        title: fill('{bank} מבקש להחליף סיסמה'),
        hint: 'היכנס לאתר הבנק, החלף סיסמה ועדכן את הסיסמה החדשה בהגדרות',
      };
    case 'ACCOUNT_BLOCKED':
      return {
        title: fill('החשבון ב{bank} נחסם'),
        hint: 'יש להיכנס לאתר הבנק ולשחרר את החסימה',
      };
    case 'TIMEOUT':
      return {
        title: fill('{bank} לא הגיב בזמן'),
        hint: 'ייתכן שהאתר עמוס — נסה שוב בעוד כמה דקות',
      };
    case 'TWO_FACTOR_RETRIEVER_MISSING':
      return {
        title: fill('{bank} דורש קוד אימות'),
        hint: 'הבנק שולח קוד אימות (SMS או אפליקציה) שלא נתמך אוטומטית',
      };
    case 'GENERIC':
    case 'GENERAL_ERROR':
      // fall through to heuristics below
      break;
    default:
      break;
  }

  // Heuristics on the raw message when no errorType is available
  if (looksLikeNetworkError(rawMessage)) {
    return {
      title: fill('אין חיבור לאינטרנט או ש{bank} לא זמין כעת'),
      hint: 'בדוק את החיבור לאינטרנט ונסה שוב',
    };
  }

  if (rawMessage && /cancel(led)?/i.test(rawMessage)) {
    return {
      title: fill('הסנכרון של {bank} בוטל'),
    };
  }

  return {
    title: fill('תקלה לא צפויה ב{bank}'),
    hint: 'נסה להריץ שוב, ואם זה חוזר — בדוק שפרטי ההתחברות תקינים',
  };
}
