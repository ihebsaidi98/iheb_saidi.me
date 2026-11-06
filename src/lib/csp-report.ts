/**
 * src/lib/csp-report.ts
 *
 * Helper utilities for sanitizing Content Security Policy (CSP) violation reports.
 */

import {
  CONTROL_CHARS_PATTERN,
  INVISIBLE_CHARS_PATTERN,
  redactSecrets,
} from "./redact";

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
  const redacted = redactSecrets(raw);

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
