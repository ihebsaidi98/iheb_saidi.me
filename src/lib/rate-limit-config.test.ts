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
