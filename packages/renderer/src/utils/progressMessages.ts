/**
 * Friendly Hebrew translations for the raw progress-event messages emitted by
 * israeli-bank-scrapers-core and our own importer wrapper. Anything not in this
 * map falls through unchanged.
 */
const PROGRESS_TRANSLATIONS: Record<string, string> = {
  // Internal markers from importTransactions.ts
  'Importer start': 'מתחיל סנכרון',
  'Importer end': 'הסנכרון הסתיים בהצלחה',

  // israeli-bank-scrapers-core ScraperProgressTypes
  START_SCRAPING: 'מתחיל סנכרון',
  INITIALIZING: 'טוען את אתר הבנק',
  LOGGING_IN: 'מתחבר לחשבון',
  LOGIN_SUCCESS: 'התחברנו בהצלחה',
  LOGIN_FAILED: 'ההתחברות נכשלה',
  CHANGE_PASSWORD: 'הבנק מבקש להחליף סיסמה',
  WAITING_FOR_TWO_FACTOR_AUTHENTICATION: 'ממתין לקוד אימות מהבנק',
  END_SCRAPING: 'הסנכרון הסתיים',
  TERMINATING: 'מסיים',
};

/**
 * Boilerplate progress events we hide entirely — the surrounding messages
 * convey the same state and we don't want to flood the user.
 */
const SKIP_PROGRESS = new Set<string>([
  'START_SCRAPING', // duplicate of "Importer start"
  'TERMINATING', // duplicate of "END_SCRAPING" / "Importer end"
  'END_SCRAPING', // duplicate of "Importer end"
]);

export function translateProgressMessage(message: string): string {
  return PROGRESS_TRANSLATIONS[message] ?? message;
}

export function shouldSkipProgressMessage(message: string): boolean {
  return SKIP_PROGRESS.has(message);
}
