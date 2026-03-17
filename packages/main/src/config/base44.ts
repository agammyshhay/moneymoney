// SECURITY: This shared API key is embedded in the compiled binary at build time.
// It is NOT a per-user secret — any user can extract it from the binary.
// The real security boundary is server-side RLS on Base44, which must enforce:
//   1. Row-level security filtering by user_uuid (not just family_id)
//   2. Field-level write protection on family_id (blocks family hijack attack)
//   3. syncData function must validate user_uuid ownership server-side
// See: security-report.html for the full vulnerability analysis.
// TODO (Phase 4): Replace shared x-api-secret with per-user Bearer tokens.
export const BASE44_DEFAULT_CONFIG = {
  url: import.meta.env.VITE_BASE44_URL || 'https://moneym.base44.app/api/functions/syncData',
  apiKey: import.meta.env.VITE_BASE44_API_KEY || '',
};
