/**
 * src/lib/csp-report.ts
 *
 * Helper utilities for sanitizing Content Security Policy (CSP) violation reports.
 */

const API_KEY_PATTERN = /AIza[0-9A-Za-z-_]{35}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.-]+/gi;
// Base64 credentials contain `=` padding and `+`/`/`, so the value class is
// bounded by delimiters only: the whole credential is dropped, never a prefix.
const BASIC_AUTH_PATTERN = /\bauthorization:\s*basic\s+[^\s&"'<>,;)]+/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
// The value class accepts every non-delimiter character, so URL-encoded values
// (`%2F`, `%3D`, …) are redacted as a whole instead of up to their first `%`.
// `(?!\[REDACTED)` keeps an already-redacted value from being rewritten a
// second time, which would erase the marker that identifies the kind of secret.
// The leading group requires the name to start a word (`?key=`, `&key=`) or to
// be a suffix (`api_key=`, `client_secret=`), so `monkey=` is not a secret.
const SENSITIVE_PARAM_PATTERN =
  /(^|[^A-Za-z0-9])(token|secret|key|password|passwd|pwd|signature|sig|session|auth)=(?!\[REDACTED)[^\s&"'<>]+/gi;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;
const INVISIBLE_CHARS_PATTERN = /[\u0085\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/** Longest value written to the log for one report field, marker included. */
export const MAX_LOG_FIELD_CHARS = 200;
/** Longest raw body excerpt written to the log for a non-JSON report. */
export const MAX_LOG_SNIPPET_CHARS = 500;

/**
 * Cut a value to `maxChars` and append `…[+N]`, where N is the exact number of
 * dropped characters, so an abnormally long field stays visible as such.
 */
function truncateWithMarker(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;

  let keep = maxChars;
  for (;;) {
    const marker = `…[+${value.length - keep}]`;
    if (keep + marker.length <= maxChars) {
      // Never split a surrogate pair: the log would contain a lone half.
      const endsOnHighSurrogate = keep > 0 && (value.charCodeAt(keep - 1) & 0xfc00) === 0xd800;
      if (endsOnHighSurrogate) {
        keep -= 1;
        continue;
      }
      return value.slice(0, keep) + marker;
    }
    keep = maxChars - marker.length;
    if (keep <= 0) return marker.slice(0, maxChars);
  }
}

/**
 * Redact credentials, API keys, and sensitive tokens from reported strings,
 * neutralise anything that could break a log line, and bound the result.
 */
export function sanitizeCspReportData(raw: string, maxChars = MAX_LOG_FIELD_CHARS): string {
  const redacted = raw
    .replace(API_KEY_PATTERN, "[REDACTED_API_KEY]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED_TOKEN]")
    .replace(BASIC_AUTH_PATTERN, "Authorization: Basic [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SENSITIVE_PARAM_PATTERN, "$1$2=[REDACTED_SECRET]");

  const cleaned = redacted
    .replace(CONTROL_CHARS_PATTERN, " ")
    .replace(INVISIBLE_CHARS_PATTERN, "")
    // A double quote is what separates the pseudo-JSON fields of the log line:
    // neutralising it is what makes a reported value unable to forge one.
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return truncateWithMarker(cleaned, maxChars);
}
