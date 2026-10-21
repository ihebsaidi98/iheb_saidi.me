/**
 * src/lib/csp-report.ts
 *
 * Helper utilities for sanitizing Content Security Policy (CSP) violation reports.
 */

const API_KEY_PATTERN = /AIza[0-9A-Za-z-_]{35}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.-]+/gi;
const TOKEN_PATTERN = /(?:token|secret|key)=([A-Za-z0-9_.-]+)/gi;

/** Redact credentials, API keys, and sensitive tokens from reported strings. */
export function sanitizeCspReportData(raw: string): string {
  return raw
    .replace(API_KEY_PATTERN, "[REDACTED_API_KEY]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED_TOKEN]")
    .replace(TOKEN_PATTERN, "token=[REDACTED_SECRET]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}
