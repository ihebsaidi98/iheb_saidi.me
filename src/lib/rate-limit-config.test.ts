/**
 * src/lib/rate-limit-config.test.ts
 *
 * Unit tests for the per-route rate-limiting configuration factory.
 * No HTTP, no timers left running, no network I/O.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/rate-limit-config.test.ts
 *
 * Test coverage:
 *   - createRouteRateLimiter (defaults, env overrides, invalid env values,
 *     instance creation, auto-cleanup start, instance isolation)
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { InMemoryRateLimiter } from "./chat";
import { createRouteRateLimiter, parseEnvInt } from "./rate-limit-config";

describe("parseEnvInt", () => {
  it("returns fallback when raw value is undefined", () => {
    assert.equal(parseEnvInt(undefined, 10), 10);
  });

  it("returns fallback when raw value is an empty string or whitespace", () => {
    assert.equal(parseEnvInt("", 10), 10);
    assert.equal(parseEnvInt("   ", 10), 10);
  });

  it("returns fallback when raw value is not a numeric string ('abc')", () => {
    assert.equal(parseEnvInt("abc", 10), 10);
  });

  it("returns fallback when raw value is zero ('0')", () => {
    assert.equal(parseEnvInt("0", 10), 10);
  });

  it("returns fallback when raw value is negative ('-1')", () => {
    assert.equal(parseEnvInt("-1", 10), 10);
    assert.equal(parseEnvInt("-50", 15), 15);
  });

  it("returns fallback when raw value is NaN, Infinity or -Infinity", () => {
    assert.equal(parseEnvInt("NaN", 10), 10);
    assert.equal(parseEnvInt("Infinity", 10), 10);
    assert.equal(parseEnvInt("-Infinity", 10), 10);
  });

  it("returns fallback when raw value exceeds Number.MAX_SAFE_INTEGER", () => {
    assert.equal(parseEnvInt("9007199254740992", 10), 10);
  });

  it("returns parsed integer when raw value is a valid positive safe integer", () => {
    assert.equal(parseEnvInt("1", 10), 1);
    assert.equal(parseEnvInt("10", 10), 10);
    assert.equal(parseEnvInt(" 15 ", 10), 15);
    assert.equal(parseEnvInt("60000", 1000), 60000);
  });

  // ============================================================
  // AUD-11 — strict parsing of environment integers
  //
  // A value that merely *starts* with digits must never be silently
  // truncated: `parseInt` turned "1e3" into 1 and "2abc" into 2, i.e. a typo
  // rewrote the quota instead of falling back to the documented default.
  // The fallback is 7 here (never equal to the truncated value) so every
  // assertion below distinguishes "accepted" from "fell back".
  // ============================================================

  it("rejects a numeric prefix followed by junk ('10abc')", () => {
    assert.equal(parseEnvInt("10abc", 7), 7);
    assert.equal(parseEnvInt("15 req/min", 7), 7);
    assert.equal(parseEnvInt("10-", 7), 7);
  });

  it("rejects scientific notation ('1e3', '1E3')", () => {
    assert.equal(parseEnvInt("1e3", 7), 7);
    assert.equal(parseEnvInt("1E3", 7), 7);
    assert.equal(parseEnvInt("1e+3", 7), 7);
  });

  it("rejects decimal values ('10.5', '10.0')", () => {
    assert.equal(parseEnvInt("10.5", 7), 7);
    assert.equal(parseEnvInt("10.0", 7), 7);
    assert.equal(parseEnvInt("10,5", 7), 7);
  });

  it("rejects an explicit plus sign ('+10') on top of negative values ('-10')", () => {
    assert.equal(parseEnvInt("+10", 7), 7);
    assert.equal(parseEnvInt("-10", 7), 7);
    assert.equal(parseEnvInt("- 10", 7), 7);
  });

  it("rejects digit separators, hexadecimal and internal whitespace", () => {
    assert.equal(parseEnvInt("1_000", 7), 7);
    assert.equal(parseEnvInt("0x10", 7), 7);
    assert.equal(parseEnvInt("1 0", 7), 7);
    assert.equal(parseEnvInt("1\n0", 7), 7);
  });

  it("still accepts surrounding whitespace and leading zeros (valid values stay valid)", () => {
    assert.equal(parseEnvInt(" 15 ", 7), 15);
    assert.equal(parseEnvInt("\t42\n", 7), 42);
    assert.equal(parseEnvInt("015", 7), 15);
    assert.equal(parseEnvInt("60000", 7), 60000);
  });

  it("accepts Number.MAX_SAFE_INTEGER and rejects anything above it", () => {
    assert.equal(parseEnvInt("9007199254740991", 7), 9007199254740991);
    assert.equal(parseEnvInt("9007199254740992", 7), 7);
    assert.equal(parseEnvInt("99999999999999999999", 7), 7);
  });

  it("keeps every documented rate-limit value compatible (.env.example and README)", () => {
    // Limits and windows shipped in the example env file; none may regress.
    const documented: Record<string, number> = {
      "10": 10,
      "15": 15,
      "2": 2,
      "30": 30,
      "60": 60,
      "60000": 60000,
      "45000": 45000,
      " 60000 ": 60000,
    };
    for (const [raw, expected] of Object.entries(documented)) {
      assert.equal(parseEnvInt(raw, 1), expected, `documented value ${JSON.stringify(raw)} must stay valid`);
    }
  });
});

describe("createRouteRateLimiter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Start from a clean slate: remove every rate-limit env var the factory may read.
    delete process.env.TEST_RATE_LIMIT;
    delete process.env.TEST_RATE_WINDOW_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses the provided defaults when env vars are absent", () => {
    const { limit, windowMs, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10);
    assert.equal(windowMs, 60_000);
    // Behavioural check: the 10th request passes, the 11th is blocked.
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimiter.check("defaults-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("defaults-ip").allowed, false);
  });

  it("uses custom env var values when they are set", () => {
    process.env.TEST_RATE_LIMIT = "3";
    process.env.TEST_RATE_WINDOW_MS = "120000";
    const { limit, windowMs, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 3);
    assert.equal(windowMs, 120000);
    for (let i = 0; i < 3; i++) {
      assert.equal(rateLimiter.check("custom-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("custom-ip").allowed, false);
  });

  it("falls back to default limit when env var is invalid ('abc') and maintains active rate limiting", () => {
    process.env.TEST_RATE_LIMIT = "abc";
    const { limit, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10, "invalid env value must fall back to default limit");
    // Verify rate limiting is NOT disabled: requests are blocked after the 10th
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimiter.check("abc-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("abc-ip").allowed, false);
  });

  it("falls back to default limit when env var is empty string ('')", () => {
    process.env.TEST_RATE_LIMIT = "";
    const { limit } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10);
  });

  it("falls back to default limit when env var is zero ('0')", () => {
    process.env.TEST_RATE_LIMIT = "0";
    const { limit, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimiter.check("zero-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("zero-ip").allowed, false);
  });

  it("falls back to default limit when env var is negative ('-1')", () => {
    process.env.TEST_RATE_LIMIT = "-1";
    const { limit, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimiter.check("neg-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("neg-ip").allowed, false);
  });

  it("falls back to default window when window env var is invalid", () => {
    process.env.TEST_RATE_WINDOW_MS = "invalid";
    const { windowMs } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(windowMs, 60_000);
  });

  it("ignores a truncated env value instead of silently lowering the quota", () => {
    // Before AUD-11, "2abc" was parsed as 2 and replaced the default of 10.
    process.env.TEST_RATE_LIMIT = "2abc";
    const { limit, rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      10,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.equal(limit, 10, "a malformed limit must fall back, not be truncated");
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimiter.check("truncated-ip").allowed, true);
    }
    assert.equal(rateLimiter.check("truncated-ip").allowed, false);
  });

  it("creates an InMemoryRateLimiter instance", () => {
    const { rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      5,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    assert.ok(rateLimiter instanceof InMemoryRateLimiter);
    // The limiter is functional out of the box.
    const result = rateLimiter.check("instance-ip");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 4);
  });

  it("starts auto-cleanup on the created instance", () => {
    const { rateLimiter } = createRouteRateLimiter(
      "TEST_RATE_LIMIT",
      5,
      "TEST_RATE_WINDOW_MS",
      60_000,
    );
    // Calling startAutoCleanup again must be a no-op (guard `if (this.cleanupTimer) return`),
    // which proves the timer was already armed by the factory.
    const sizeBefore = rateLimiter.size;
    assert.doesNotThrow(() => rateLimiter.startAutoCleanup());
    assert.equal(rateLimiter.size, sizeBefore);
    // Cleanup must not throw and must leave the instance usable.
    assert.doesNotThrow(() => rateLimiter.cleanup());
    assert.equal(rateLimiter.check("cleanup-ip").allowed, true);
    rateLimiter.stopAutoCleanup();
  });

  it("creates two distinct instances on two factory calls", () => {
    const a = createRouteRateLimiter("TEST_RATE_LIMIT", 1, "TEST_RATE_WINDOW_MS", 60_000);
    const b = createRouteRateLimiter("TEST_RATE_LIMIT", 1, "TEST_RATE_WINDOW_MS", 60_000);
    assert.notEqual(a.rateLimiter, b.rateLimiter, "each factory call must produce a new limiter");
    // State is independent: exhausting a does not affect b.
    a.rateLimiter.check("shared-ip");
    assert.equal(b.rateLimiter.check("shared-ip").allowed, true);
    a.rateLimiter.stopAutoCleanup();
    b.rateLimiter.stopAutoCleanup();
  });
});
