/**
 * src/app/api/ai/health/route.test.ts
 *
 * F1 (audit M2-04) — GET /api/ai/health is public, so it is rate limited per
 * client IP and exposes only a status, never the readiness details of the
 * Python service.
 *
 * The handler owns a module-level limiter: each test loads a fresh instance of
 * the route module so the quota starts cold. `globalThis.fetch` is stubbed, so
 * no test ever reaches the network.
 */

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";

type HealthRoute = typeof import("./route");

const routeUrl = new URL("./route.ts", import.meta.url);
let instanceCounter = 0;

/** Load a brand-new instance of the route module (cold quota). */
async function freshRoute(): Promise<HealthRoute> {
  instanceCounter += 1;
  return (await import(`${routeUrl.href}?fresh=${instanceCounter}`)) as HealthRoute;
}

// F1: default quota from createRouteRateLimiter("AI_HEALTH_RATE_LIMIT", 60, …).
const RATE_LIMIT = 60;

const READY_PAYLOAD = {
  status: "ready",
  service: "portfolio-ai-service",
  version: "0.1.0",
  environment: "production",
  gemini_configured: true,
  index_loaded: true,
  index_records: 42,
};

const originalFetch = globalThis.fetch;
const originalTrustedProxy = process.env.TRUSTED_PROXY;
let fetchCalls = 0;
let respond: () => Response = () =>
  new Response(JSON.stringify(READY_PAYLOAD), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

function get(ip: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (ip !== null) headers["x-forwarded-for"] = ip;
  return new NextRequest("http://localhost:3000/api/ai/health", { headers });
}

before(() => {
  process.env.TRUSTED_PROXY = "true";
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return respond();
  }) as typeof fetch;
});

beforeEach(() => {
  fetchCalls = 0;
  respond = () =>
    new Response(JSON.stringify(READY_PAYLOAD), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
  else process.env.TRUSTED_PROXY = originalTrustedProxy;
});

describe("GET /api/ai/health — F1 public payload", () => {
  it("reports only the readiness status, never the Python service internals", async () => {
    const { GET } = await freshRoute();

    const response = await GET(get("203.0.113.71"));

    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["pythonService", "status"]);
    assert.equal(body.status, "ok");
    assert.deepEqual(body.pythonService, { status: "ready" });

    const serialized = JSON.stringify(body);
    for (const leaked of [
      "environment",
      "gemini_configured",
      "index_loaded",
      "index_records",
      "version",
      "portfolio-ai-service",
      "production",
    ]) {
      assert.ok(!serialized.includes(leaked), `leaked '${leaked}' in ${serialized}`);
    }
  });

  it("answers 503 with a public message when the Python service is unavailable", async () => {
    respond = () =>
      new Response(JSON.stringify({ detail: "internal readiness details" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });

    const { GET } = await freshRoute();
    const envObj = process.env as Record<string, string | undefined>;
    const originalNodeEnv = envObj.NODE_ENV;
    try {
      envObj.NODE_ENV = "production";

      const response = await GET(get("203.0.113.72"));

      assert.equal(response.status, 503);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body.status, "unavailable");
      assert.equal(typeof body.error, "string");
      assert.deepEqual(Object.keys(body).sort(), ["error", "status"]);

      const serialized = JSON.stringify(body);
      assert.ok(!serialized.includes("internal readiness details"));
      assert.ok(!serialized.includes("AI_SERVICE_URL"));
    } finally {
      envObj.NODE_ENV = originalNodeEnv;
    }
  });
});

describe("GET /api/ai/health — F1 rate limiting", () => {
  it("limits each IP and answers 429 over the quota", async () => {
    const { GET } = await freshRoute();
    const ip = "203.0.113.73";

    for (let i = 0; i < RATE_LIMIT; i++) {
      const response = await GET(get(ip));
      assert.equal(response.status, 200, `request ${i + 1} should be accepted`);
    }

    const limited = await GET(get(ip));

    assert.equal(limited.status, 429);
    const body = (await limited.json()) as { code?: string; retryAfterMs?: number };
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(typeof body.retryAfterMs, "number");
    assert.equal(limited.headers.get("x-ratelimit-limit"), String(RATE_LIMIT));
    assert.equal(limited.headers.get("x-ratelimit-remaining"), "0");
    assert.ok(limited.headers.get("retry-after"));
  });

  it("does not call the Python service once the quota is exceeded", async () => {
    const { GET } = await freshRoute();
    const ip = "203.0.113.74";

    for (let i = 0; i < RATE_LIMIT; i++) {
      assert.equal((await GET(get(ip))).status, 200);
    }

    fetchCalls = 0;
    const limited = await GET(get(ip));

    assert.equal(limited.status, 429);
    assert.equal(fetchCalls, 0, "an over-quota health check must not reach the AI service");
  });

  it("fails closed with 500 and no call when the client IP cannot be verified", async () => {
    const { GET } = await freshRoute();
    const envObj = process.env as Record<string, string | undefined>;
    const originalNodeEnv = envObj.NODE_ENV;
    const originalProxy = envObj.TRUSTED_PROXY;
    try {
      envObj.NODE_ENV = "production";
      delete envObj.TRUSTED_PROXY;

      const response = await GET(get(null));

      assert.equal(response.status, 500);
      const body = (await response.json()) as { code?: string };
      assert.equal(body.code, "IP_VERIFICATION_FAILED");
      assert.equal(fetchCalls, 0);
    } finally {
      envObj.NODE_ENV = originalNodeEnv;
      envObj.TRUSTED_PROXY = originalProxy;
    }
  });
});
