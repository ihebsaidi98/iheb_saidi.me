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
 *   - Env vars are safely validated after parsing: invalid, non-positive,
 *     or non-safe integers fallback to defaults (fixes VULN-01).
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
 * Safely parse an environment variable as a strictly positive safe integer.
 * Falls back to default if absent, empty, NaN, <= 0, or not a safe integer.
 */
export function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = parseInt(raw, 10);
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
