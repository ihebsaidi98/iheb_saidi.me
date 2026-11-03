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

function get(ip: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/tech-news", {
    headers: { "x-forwarded-for": ip },
  });
}

before(() => {
  process.env.TRUSTED_PROXY = "true";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    const url = String(input);
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
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
  else process.env.TRUSTED_PROXY = originalTrustedProxy;
});

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
