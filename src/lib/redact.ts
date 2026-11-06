/**
 * src/lib/redact.ts
 *
 * Centralized secret redaction and log sanitization utilities.
 * Ensures consistent protection of sensitive credentials, tokens, and API keys
 * across server-side logs (Chat, CSP reporting, telemetry).
 */

export const API_KEY_PATTERN = /AIza[0-9A-Za-z-_]{35}/g;
export const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.-]+/gi;
// Base64 credentials contain `=` padding and `+`/`/`, so the value class is
// bounded by delimiters only: the whole credential is dropped, never a prefix.
export const BASIC_AUTH_PATTERN = /\bauthorization:\s*basic\s+[^\s&"'<>,;)]+/gi;
export const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
// The value class accepts every non-delimiter character, so URL-encoded values
// (`%2F`, `%3D`, …) are redacted as a whole instead of up to their first `%`.
// `(?!\[REDACTED)` keeps an already-redacted value from being rewritten a
// second time, which would erase the marker that identifies the kind of secret.
// The leading group requires the name to start a word (`?key=`, `&key=`) or to
// be a suffix (`api_key=`, `client_secret=`), so `monkey=` is not a secret.
export const SENSITIVE_PARAM_PATTERN =
  /(^|[^A-Za-z0-9])(token|secret|key|password|passwd|pwd|signature|sig|session|auth)=(?!\[REDACTED)[^\s&"'<>]+/gi;

export const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;
export const INVISIBLE_CHARS_PATTERN = /[\u0085\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/**
 * Pure function that redacts sensitive credentials, tokens, and secrets from text.
 *
 * Preserves the substitution order established by CSP report sanitization:
 * 1. Google API keys (`AIza...`)
 * 2. Bearer tokens (`Bearer ...`)
 * 3. HTTP Basic Authorization
 * 4. Raw JWTs (`eyJ...`)
 * 5. Sensitive query/body parameters (`token=`, `secret=`, `key=`, etc.)
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(API_KEY_PATTERN, "[REDACTED_API_KEY]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED_TOKEN]")
    .replace(BASIC_AUTH_PATTERN, "Authorization: Basic [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SENSITIVE_PARAM_PATTERN, "$1$2=[REDACTED_SECRET]");
}

/**
 * Redacts secrets and neutralizes control characters, CR/LF, and bidi/invisible
 * characters to prevent log forgery, log splitting, or terminal escape injection.
 *
 * Preserves quotes, JSON formatting, and diagnostic details (HTTP codes, error names).
 * Does not perform arbitrary truncation.
 */
export function sanitizeLogMessage(text: string): string {
  if (!text) return text;

  const redacted = redactSecrets(text);

  return redacted
    .replace(CONTROL_CHARS_PATTERN, " ")
    .replace(INVISIBLE_CHARS_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}
