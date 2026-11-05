/**
 * src/lib/rate-limit-config.ts
 *
 * Centralizes the per-route rate-limiting configuration that was previously
 * duplicated across the API route handlers (chat + interview start/submit/
 * complete).
 *
 * What this factory guarantees (identical to the previous inline code):
 *   - Each route gets ONE module-level rate limiter instance, created exactly
 *     once when the module is first imported — never per request.
 *   - Auto-cleanup is started immediately (same 60s default interval as
 *     `InMemoryRateLimiter.startAutoCleanup()`).
 *   - Env vars are safely validated after parsing: anything that is not plain
 *     decimal digits, non-positive, or non-safe integers falls back to the
 *     defaults, so a typo can neither disable nor silently shrink a quota
 *     (VULN-01, AUD-11).
 *
 * What this factory intentionally does NOT do:
 *   - It does not change the in-memory (per-process, volatile) nature of the
 *     store. Durability / multi-instance synchronization is out of scope.
 */
import { InMemoryRateLimiter } from "./chat";

export type RouteRateLimit = {
  /** Requests allowed per window (from env or default). */
  limit: number;
  /** Window duration in milliseconds (from env or default). */
  windowMs: number;
  /** Module-level singleton — persists across requests in the same process. */
  rateLimiter: InMemoryRateLimiter;
};

/**
 * A value is accepted only when it is plain ASCII decimal digits.
 *
 * `parseInt` is deliberately NOT used: it stops at the first non-digit, so
 * `"1e3"` became 1 and `"2abc"` became 2 — a typo silently replaced the quota
 * instead of falling back to the documented default. Signs, dashes, decimal
 * points, exponents, digit separators, hex prefixes and internal whitespace
 * are all rejected here, then reported as a fallback.
 */
const DECIMAL_INT_PATTERN = /^[0-9]+$/;

/**
 * Safely parse an environment variable as a strictly positive safe integer.
 *
 * Accepted: `undefined`/blank -> `fallback`; surrounding whitespace is trimmed
 * (`" 15 "` -> 15); leading zeros are kept harmless (`"015"` -> 15); anything
 * from 1 up to `Number.MAX_SAFE_INTEGER` -> its numeric value.
 * Rejected (-> `fallback`): empty, `0`, negative, `NaN`/`Infinity`, values
 * above `Number.MAX_SAFE_INTEGER`, and any non-digit character anywhere
 * (`"10abc"`, `"1e3"`, `"10.5"`, `"+10"`, `"1_000"`, `"0x10"`).
 */
export function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!DECIMAL_INT_PATTERN.test(trimmed)) {
    // Covers the empty string and whitespace-only input as well.
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Create the singleton route rate limiter.
 *
 * Call ONCE at module scope of a route handler. Example:
 *
 *   const { limit, rateLimiter } = createRouteRateLimiter(
 *     "CHAT_RATE_LIMIT", 10, "CHAT_RATE_WINDOW_MS", 60_000,
 *   );
 *
 * @param limitEnv       Name of the env var holding the request limit.
 * @param defaultLimit   Fallback limit when the env var is unset.
 * @param windowEnv      Name of the env var holding the window (ms).
 * @param defaultWindow  Fallback window when the env var is unset.
 */
export function createRouteRateLimiter(
  limitEnv: string,
  defaultLimit: number,
  windowEnv: string,
  defaultWindow: number,
): RouteRateLimit {
  const limit = parseEnvInt(process.env[limitEnv], defaultLimit);
  const windowMs = parseEnvInt(process.env[windowEnv], defaultWindow);
  const rateLimiter = new InMemoryRateLimiter(limit, windowMs);
  rateLimiter.startAutoCleanup();
  return { limit, windowMs, rateLimiter };
}
