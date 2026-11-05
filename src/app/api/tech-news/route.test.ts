/**
 * src/app/api/tech-news/route.test.ts
 *
 * M2-01 — rate limiting for the public GET /api/tech-news endpoint.
 *
 * The handler keeps a module-level cache and a module-level limiter. To keep
 * every test independent, each one loads a fresh instance of the route module
 * (unique query string), so both the cache and the quota start cold.
 * `globalThis.fetch` is stubbed: no test ever reaches the network.
 */

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { fetchAllFeeds as realFetchAllFeeds } from "@/lib/tech-news";
import { setFeedSource } from "@/lib/tech-news-feed-source";

type TechNewsRoute = typeof import("./route");

const routeUrl = new URL("./route.ts", import.meta.url);
let instanceCounter = 0;

/** Load a brand-new instance of the route module (cold cache, cold quota). */
async function freshRoute(): Promise<TechNewsRoute> {
  instanceCounter += 1;
  return (await import(`${routeUrl.href}?fresh=${instanceCounter}`)) as TechNewsRoute;
}

// M2-01: default quota from createRouteRateLimiter("TECH_NEWS_RATE_LIMIT", 30, …).
const RATE_LIMIT = 30;
// 15 feeds are configured in src/lib/tech-news.ts (11 DEV.to + 4 RSS/Atom).
const FEED_COUNT = 15;

const originalFetch = globalThis.fetch;
const originalTrustedProxy = process.env.TRUSTED_PROXY;
let fetchCalls = 0;

/**
 * M2-05: when set, every feed fetch waits on this gate before resolving, so a
 * test can hold a refresh open and start concurrent callers deterministically.
 */
let fetchGate: Promise<void> | null = null;
/** When true, every feed fetch rejects (simulates a total upstream failure). */
let failFeeds = false;
/**
 * When true, `fetchAllFeeds` itself rejects. Per-feed failures are absorbed by
 * `Promise.allSettled` inside the library, so this is the only way to exercise
 * the route's own catch block (stale fallback / 502).
 */
let failFetchAllFeeds = false;

function get(ip: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/tech-news", {
    headers: { "x-forwarded-for": ip },
  });
}

before(() => {
  process.env.TRUSTED_PROXY = "true";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    if (fetchGate) await fetchGate;
    const url = String(input);
    if (failFeeds) throw new Error("upstream unavailable");
    if (url.includes("dev.to")) {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("<feed></feed>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }) as typeof fetch;
});

beforeEach(() => {
  fetchCalls = 0;
  fetchGate = null;
  failFeeds = false;
  failFetchAllFeeds = false;
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
  else process.env.TRUSTED_PROXY = originalTrustedProxy;
});

/** A promise plus its resolver, used to hold a refresh open without sleeps. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Let every pending microtask/timer callback run until the gate is released. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}

describe("GET /api/tech-news — M2-01 rate limiting", () => {
  it("fails closed with 500 and no external call when the IP cannot be verified", async () => {
    const { GET } = await freshRoute();
    const envObj = process.env as Record<string, string | undefined>;
    const originalNodeEnv = envObj.NODE_ENV;
    const originalProxy = envObj.TRUSTED_PROXY;
    try {
      envObj.NODE_ENV = "production";
      delete envObj.TRUSTED_PROXY;

      const response = await GET(get("203.0.113.50"));

      assert.equal(response.status, 500);
      const body = (await response.json()) as { code?: string };
      assert.equal(body.code, "IP_VERIFICATION_FAILED");
      assert.equal(fetchCalls, 0, "no feed must be fetched when the client IP is unusable");
    } finally {
      envObj.NODE_ENV = originalNodeEnv;
      envObj.TRUSTED_PROXY = originalProxy;
    }
  });

  it("serves the first request, then keeps serving it from cache", async () => {
    const { GET } = await freshRoute();

    const first = await GET(get("203.0.113.51"));
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { cached?: boolean; articles?: unknown[] };
    assert.equal(firstBody.cached, false);
    assert.ok(Array.isArray(firstBody.articles));
    assert.equal(fetchCalls, FEED_COUNT, "the cold request fetches every configured feed once");

    const second = await GET(get("203.0.113.51"));
    assert.equal(second.status, 200);
    const secondBody = (await second.json()) as { cached?: boolean };
    assert.equal(secondBody.cached, true, "the cache must still be used");
    assert.equal(fetchCalls, FEED_COUNT, "a cached response must not trigger any external call");
  });

  it("limits each IP independently and rejects the request over the quota", async () => {
    const { GET } = await freshRoute();
    const ip = "203.0.113.52";

    for (let i = 0; i < RATE_LIMIT; i++) {
      const response = await GET(get(ip));
      assert.equal(response.status, 200, `request ${i + 1} should be accepted`);
    }

    fetchCalls = 0;
    const limited = await GET(get(ip));
    assert.equal(limited.status, 429);
    assert.equal(fetchCalls, 0, "an over-quota request must not reach the feeds");

    const body = (await limited.json()) as { code?: string; retryAfterMs?: number; articles?: unknown };
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(typeof body.retryAfterMs, "number");
    assert.equal(body.articles, undefined, "the rate-limited response must not carry the news payload");
    assert.ok(limited.headers.get("retry-after"));
    assert.equal(limited.headers.get("x-ratelimit-limit"), String(RATE_LIMIT));
    assert.equal(limited.headers.get("x-ratelimit-remaining"), "0");

    const otherIp = await GET(get("203.0.113.53"));
    assert.equal(otherIp.status, 200, "a different IP keeps its own quota");

    const stillLimited = await GET(get(ip));
    assert.equal(stillLimited.status, 429);
  });
});

describe("GET /api/tech-news — M2-05 in-flight refresh deduplication", () => {
  // Each test loads a fresh route module, so the cache and quota start cold.
  async function freshRouteWithSeam(): Promise<TechNewsRoute> {
    setFeedSource(async (devToApiKey?: string) => {
      if (failFetchAllFeeds) throw new Error("aggregator unavailable");
      return realFetchAllFeeds(devToApiKey);
    });
    return freshRoute();
  }

  after(() => {
    setFeedSource(realFetchAllFeeds);
  });

  it("A. concurrent cold-cache requests share a single refresh", async () => {
    const { GET } = await freshRouteWithSeam();
    const gate = deferred();
    fetchGate = gate.promise;

    const callers = [
      GET(get("198.51.100.10")),
      GET(get("198.51.100.11")),
      GET(get("198.51.100.12")),
      GET(get("198.51.100.13")),
    ];

    await flush();
    assert.equal(fetchCalls, FEED_COUNT, "only one refresh may reach the feeds while pending");

    gate.resolve();
    const responses = await Promise.all(callers);

    assert.equal(fetchCalls, FEED_COUNT, "concurrent callers must not multiply feed requests");
    for (const res of responses) {
      assert.equal(res.status, 200);
      const body = (await res.json()) as { cached?: boolean; articles?: unknown[] };
      assert.equal(body.cached, false);
      assert.ok(Array.isArray(body.articles));
    }
  });

  it("B. concurrent requests on an expired cache share a single refresh", async () => {
    const { GET } = await freshRouteWithSeam();

    const warm = await GET(get("198.51.100.20"));
    assert.equal(warm.status, 200);
    assert.equal(fetchCalls, FEED_COUNT);

    // Expire the entry by moving the clock past the 30-minute TTL.
    const realNow = Date.now();
    const originalDateNow = Date.now;
    Date.now = () => realNow + 31 * 60 * 1_000;
    try {
      fetchCalls = 0;
      const gate = deferred();
      fetchGate = gate.promise;

      const callers = [
        GET(get("198.51.100.21")),
        GET(get("198.51.100.22")),
        GET(get("198.51.100.23")),
      ];

      await flush();
      assert.equal(fetchCalls, FEED_COUNT, "an expired cache must trigger exactly one refresh");

      gate.resolve();
      const responses = await Promise.all(callers);

      assert.equal(fetchCalls, FEED_COUNT);
      for (const res of responses) {
        assert.equal(res.status, 200);
        const body = (await res.json()) as { cached?: boolean };
        assert.equal(body.cached, false, "callers must receive the refreshed payload");
      }
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("C. a failed refresh serves the stale cache to every waiting caller", async () => {
    const { GET } = await freshRouteWithSeam();

    const warm = await GET(get("198.51.100.30"));
    assert.equal(warm.status, 200);
    const warmBody = (await warm.json()) as { fetchedAt?: string };

    const realNow = Date.now();
    const originalDateNow = Date.now;
    Date.now = () => realNow + 31 * 60 * 1_000;
    try {
      fetchCalls = 0;
      failFetchAllFeeds = true;

      const callers = [
        GET(get("198.51.100.31")),
        GET(get("198.51.100.32")),
        GET(get("198.51.100.33")),
      ];
      const responses = await Promise.all(callers);

      assert.equal(fetchCalls, 0, "the aggregator failure must be attempted only once");
      for (const res of responses) {
        assert.equal(res.status, 200, "stale cache is served instead of an error");
        const body = (await res.json()) as { cached?: boolean; fetchedAt?: string };
        assert.equal(body.cached, true);
        assert.equal(body.fetchedAt, warmBody.fetchedAt, "the stale entry must not be replaced");
      }
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("D. a rejected refresh is not retained: the next request retries and succeeds", async () => {
    const { GET } = await freshRouteWithSeam();

    failFetchAllFeeds = true;
    const failed = await GET(get("198.51.100.40"));
    assert.equal(failed.status, 502, "no cache available, so the existing 502 is returned");

    failFetchAllFeeds = false;
    fetchCalls = 0;
    const retried = await GET(get("198.51.100.41"));
    assert.equal(retried.status, 200);
    assert.equal(fetchCalls, FEED_COUNT, "a new refresh must be started after a rejection");
    const body = (await retried.json()) as { cached?: boolean };
    assert.equal(body.cached, false);
  });

  it("E. a failed refresh with no cache returns the unchanged 502 body", async () => {
    const { GET } = await freshRouteWithSeam();
    failFetchAllFeeds = true;

    const res = await GET(get("198.51.100.50"));

    assert.equal(res.status, 502);
    const body = (await res.json()) as {
      articles?: unknown[];
      feedErrors?: Record<string, string>;
      cached?: boolean;
    };
    assert.deepEqual(body.articles, []);
    assert.deepEqual(body.feedErrors, { global: "Failed to fetch news." });
    assert.equal(body.cached, false);
  });
});
