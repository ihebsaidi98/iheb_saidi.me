/**
 * src/lib/rate-limit-headers.test.ts
 *
 * AUD-09 — one contract for the rate-limit headers, across every route that
 * enforces a quota.
 *
 * The contract this file pins down:
 *
 *   Q0 — responses emitted BEFORE the quota is computed
 *        (`extractClientIp()` throws → 500 IP_VERIFICATION_FAILED, or the
 *        dispatcher rejects the method → 405). No quota information exists,
 *        so no `X-RateLimit-*` header may be present.
 *
 *   Q1 — responses emitted AFTER the quota was consumed, whether 2xx or not:
 *        `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
 *        A 400/413/415/502/503 is still a request that consumed quota; hiding
 *        the counters only from those responses makes the quota opaque.
 *
 *   Q2 — quota exceeded (429): the three headers above plus `Retry-After`.
 *
 *   Exception — a response explicitly marked publicly cacheable
 *        (`Cache-Control: public, s-maxage=…`) must NOT carry per-client
 *        counters: a shared cache would replay one caller's quota state, and
 *        would serve the body without consuming anything. `/api/tech-news`
 *        200s are the only such responses (M2-01/M2-05 caching contract).
 *
 * Modes follow the repo's defaults; the env below only shrinks the quotas so a
 * 429 is reachable in a handful of cheap requests.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/rate-limit-headers.test.ts
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { fetchAllFeeds } from "@/lib/tech-news";
import { setFeedSource } from "@/lib/tech-news-feed-source";

// ---- Environment must be set before the route modules are imported ----
// (every route reads its quota env var and builds its limiter at module load)
const CHAT_LIMIT = 3;
const CSP_LIMIT = 2;
const TECH_NEWS_LIMIT = 2;
const AI_HEALTH_LIMIT = 2;
const INTERVIEW_LIMIT = 2;
const INTERVIEW_COMPLETE_LIMIT = 1;

process.env.TRUSTED_PROXY = "true";
process.env.CHAT_RATE_LIMIT = String(CHAT_LIMIT);
process.env.CSP_REPORT_RATE_LIMIT = String(CSP_LIMIT);
process.env.TECH_NEWS_RATE_LIMIT = String(TECH_NEWS_LIMIT);
process.env.AI_HEALTH_RATE_LIMIT = String(AI_HEALTH_LIMIT);
process.env.INTERVIEW_RATE_LIMIT = String(INTERVIEW_LIMIT);
process.env.INTERVIEW_COMPLETE_RATE_LIMIT = String(INTERVIEW_COMPLETE_LIMIT);
delete process.env.GEMINI_API_KEY;
// A URL without a token keeps `isConfigured()` false (interview routes fail
// closed with 503) while `checkHealth()` still has somewhere to point.
process.env.AI_SERVICE_URL = "http://ai.test:8000";
delete process.env.AI_SERVICE_TOKEN;

const QUOTA_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const;

/** The three counters every post-quota response must carry. */
function assertQuotaCounters(
  response: Response,
  where: string,
  expectedLimit?: number,
): void {
  for (const header of QUOTA_HEADERS) {
    assert.ok(
      response.headers.get(header) !== null,
      `${where}: missing ${header} on a response emitted after the quota was consumed`,
    );
  }
  if (expectedLimit !== undefined) {
    assert.equal(
      response.headers.get("x-ratelimit-limit"),
      String(expectedLimit),
      `${where}: X-RateLimit-Limit must stay the configured quota`,
    );
  }
}

/** A non-429 response that consumed quota: counters, and no Retry-After. */
function expectQuotaHeaders(
  response: Response,
  where: string,
  expectedLimit?: number,
): void {
  assertQuotaCounters(response, where, expectedLimit);
  assert.equal(
    response.headers.get("retry-after"),
    null,
    `${where}: Retry-After is only meaningful on a 429`,
  );
}

/** A request rejected before the quota exists must not invent counters. */
function expectNoQuotaHeaders(response: Response, where: string): void {
  for (const header of [...QUOTA_HEADERS, "retry-after"]) {
    assert.equal(
      response.headers.get(header),
      null,
      `${where}: ${header} must be absent: no quota was ever computed`,
    );
  }
}

function expectQuotaExceededHeaders(response: Response, where: string): void {
  assertQuotaCounters(response, where);
  const retryAfter = response.headers.get("retry-after");
  assert.ok(retryAfter !== null, `${where}: a 429 must carry Retry-After`);
  assert.match(retryAfter, /^\d+$/, `${where}: Retry-After must be integer seconds`);
}

const BASE = "http://localhost:3000";

function request(
  path: string,
  init: { method?: string; body?: string; ip?: string; headers?: Record<string, string> },
): NextRequest {
  const headers: Record<string, string> = { ...init.headers };
  if (init.ip !== undefined) {
    headers["x-forwarded-for"] = init.ip;
  }
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "POST",
    headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

/**
 * A request whose `Content-Length` is controlled explicitly. A string body does
 * not set that header (undici streams it), so the pre-flight size check is only
 * reachable with a streamed body and an explicit header — the path every route
 * takes when a real client announces its size.
 */
function requestWithContentLength(
  path: string,
  ip: string | undefined,
  contentLength: string,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const bytes = new TextEncoder().encode("{}");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "content-length": contentLength,
    ...extraHeaders,
  };
  if (ip !== undefined) {
    headers["x-forwarded-for"] = ip;
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new NextRequest(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);
}

function postJson(path: string, body: string, ip?: string): NextRequest {
  return request(path, {
    body,
    ip,
    headers: { "content-type": "application/json" },
  });
}

// ---- Feed source + health stubs (no test reaches the network) ----
const originalFetch = globalThis.fetch;
let healthDown = false;

before(() => {
  setFeedSource(async () => ({ articles: [], feedErrors: {} }));
  globalThis.fetch = (async () => {
    if (healthDown) throw new Error("ai service unreachable");
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

after(() => {
  setFeedSource(fetchAllFeeds);
  globalThis.fetch = originalFetch;
});

// ============================================================
// POST /api/chat
// ============================================================

describe("POST /api/chat rate-limit headers (AUD-09)", () => {
  let chat: typeof import("../app/api/chat/route");

  before(async () => {
    chat = await import("../app/api/chat/route");
  });

  it("exposes the quota on the success path", async () => {
    const res = await chat.POST(postJson("/api/chat", JSON.stringify({ message: "hello" }), "10.9.1.1"));
    assert.equal(res.status, 200);
    expectQuotaHeaders(res, "chat 200", CHAT_LIMIT);
  });

  it("exposes the quota on 400 INVALID_JSON", async () => {
    const res = await chat.POST(postJson("/api/chat", "{", "10.9.1.2"));
    assert.equal(res.status, 400);
    expectQuotaHeaders(res, "chat 400 INVALID_JSON", CHAT_LIMIT);
  });

  it("exposes the quota on 400 INVALID_REQUEST", async () => {
    const res = await chat.POST(
      postJson("/api/chat", JSON.stringify({ message: 123 }), "10.9.1.3"),
    );
    assert.equal(res.status, 400);
    expectQuotaHeaders(res, "chat 400 INVALID_REQUEST", CHAT_LIMIT);
  });

  it("exposes the quota on 413 PAYLOAD_TOO_LARGE (announced size)", async () => {
    const res = await chat.POST(requestWithContentLength("/api/chat", "10.9.1.4", "70000"));
    assert.equal(res.status, 413);
    expectQuotaHeaders(res, "chat 413 (pre-flight)", CHAT_LIMIT);
  });

  it("exposes the quota on 413 PAYLOAD_TOO_LARGE (streamed size)", async () => {
    const oversized = JSON.stringify({ message: "hello", pad: "a".repeat(70_000) });
    const res = await chat.POST(postJson("/api/chat", oversized, "10.9.1.7"));
    assert.equal(res.status, 413);
    expectQuotaHeaders(res, "chat 413 (streamed)", CHAT_LIMIT);
  });

  it("exposes the quota on 503 SERVICE_UNAVAILABLE", async () => {
    const res = await chat.POST(
      postJson("/api/chat", JSON.stringify({ message: "Explain the event loop" }), "10.9.1.5"),
    );
    assert.equal(res.status, 503);
    expectQuotaHeaders(res, "chat 503", CHAT_LIMIT);
  });

  it("returns 429 with Retry-After once the quota is exhausted", async () => {
    for (let i = 0; i < CHAT_LIMIT; i++) {
      const ok = await chat.POST(postJson("/api/chat", JSON.stringify({ message: "hello" }), "10.9.1.6"));
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("x-ratelimit-remaining"), String(CHAT_LIMIT - i - 1));
    }
    const res = await chat.POST(postJson("/api/chat", JSON.stringify({ message: "hello" }), "10.9.1.6"));
    assert.equal(res.status, 429);
    expectQuotaExceededHeaders(res, "chat 429");
  });

  it("emits no quota headers when the client IP cannot be verified", async () => {
    const res = await chat.POST(postJson("/api/chat", JSON.stringify({ message: "hello" })));
    assert.equal(res.status, 500);
    expectNoQuotaHeaders(res, "chat 500 IP_VERIFICATION_FAILED");
  });

  it("emits no quota headers on 405", async () => {
    const res = await chat.GET();
    assert.equal(res.status, 405);
    expectNoQuotaHeaders(res, "chat 405");
  });
});

// ============================================================
// POST /api/csp-report
// ============================================================

describe("POST /api/csp-report rate-limit headers (AUD-09)", () => {
  let csp: typeof import("../app/api/csp-report/route");

  before(async () => {
    csp = await import("../app/api/csp-report/route");
  });

  it("exposes the quota on 204", async () => {
    const res = await csp.POST(
      request("/api/csp-report", {
        ip: "10.9.2.1",
        body: JSON.stringify({ "csp-report": { "blocked-uri": "inline" } }),
        headers: { "content-type": "application/csp-report" },
      }),
    );
    assert.equal(res.status, 204);
    expectQuotaHeaders(res, "csp 204", CSP_LIMIT);
  });

  it("exposes the quota on 415", async () => {
    const res = await csp.POST(
      request("/api/csp-report", {
        ip: "10.9.2.2",
        body: "nope",
        headers: { "content-type": "text/plain" },
      }),
    );
    assert.equal(res.status, 415);
    expectQuotaHeaders(res, "csp 415", CSP_LIMIT);
  });

  it("exposes the quota on 413", async () => {
    const res = await csp.POST(
      requestWithContentLength("/api/csp-report", "10.9.2.3", "20000", {
        "content-type": "application/csp-report",
      }),
    );
    assert.equal(res.status, 413);
    expectQuotaHeaders(res, "csp 413", CSP_LIMIT);
  });

  it("returns 429 with Retry-After once the quota is exhausted", async () => {
    for (let i = 0; i < CSP_LIMIT; i++) {
      const ok = await csp.POST(
        request("/api/csp-report", {
          ip: "10.9.2.4",
          body: JSON.stringify({ "csp-report": {} }),
          headers: { "content-type": "application/csp-report" },
        }),
      );
      assert.equal(ok.status, 204);
    }
    const res = await csp.POST(
      request("/api/csp-report", {
        ip: "10.9.2.4",
        body: JSON.stringify({ "csp-report": {} }),
        headers: { "content-type": "application/csp-report" },
      }),
    );
    assert.equal(res.status, 429);
    expectQuotaExceededHeaders(res, "csp 429");
  });

  it("emits no quota headers when the client IP cannot be verified", async () => {
    const res = await csp.POST(
      request("/api/csp-report", {
        body: JSON.stringify({ "csp-report": {} }),
        headers: { "content-type": "application/csp-report" },
      }),
    );
    assert.equal(res.status, 500);
    expectNoQuotaHeaders(res, "csp 500 IP_VERIFICATION_FAILED");
  });

  it("emits no quota headers on 405", async () => {
    const res = await csp.GET();
    assert.equal(res.status, 405);
    expectNoQuotaHeaders(res, "csp 405");
  });
});

// ============================================================
// GET /api/tech-news
// ============================================================

describe("GET /api/tech-news rate-limit headers (AUD-09)", () => {
  let techNews: typeof import("../app/api/tech-news/route");

  before(async () => {
    techNews = await import("../app/api/tech-news/route");
  });

  it("keeps publicly cacheable 200s free of per-client counters", async () => {
    const res = await techNews.GET(request("/api/tech-news", { method: "GET", ip: "10.9.3.1" }));
    assert.equal(res.status, 200);
    assert.match(
      res.headers.get("cache-control") ?? "",
      /public,\s*s-maxage=1800/,
      "the caching contract must stay in place",
    );
    expectNoQuotaHeaders(res, "tech-news 200 (publicly cacheable)");
  });

  it("exposes the quota on 502", async () => {
    // A fresh module instance starts with an empty cache, so the failure path is
    // reachable even though the previous test filled the shared cache.
    const routeUrl = new URL("../app/api/tech-news/route.ts", import.meta.url);
    const fresh = (await import(`${routeUrl.href}?aud09=502`)) as typeof techNews;

    setFeedSource(async () => {
      throw new Error("aggregator down");
    });
    try {
      const res = await fresh.GET(request("/api/tech-news", { method: "GET", ip: "10.9.3.2" }));
      assert.equal(res.status, 502);
      expectQuotaHeaders(res, "tech-news 502", TECH_NEWS_LIMIT);
    } finally {
      setFeedSource(async () => ({ articles: [], feedErrors: {} }));
    }
  });

  it("returns 429 with Retry-After once the quota is exhausted", async () => {
    for (let i = 0; i < TECH_NEWS_LIMIT; i++) {
      const ok = await techNews.GET(request("/api/tech-news", { method: "GET", ip: "10.9.3.3" }));
      assert.equal(ok.status, 200);
    }
    const res = await techNews.GET(request("/api/tech-news", { method: "GET", ip: "10.9.3.3" }));
    assert.equal(res.status, 429);
    expectQuotaExceededHeaders(res, "tech-news 429");
  });

  it("emits no quota headers when the client IP cannot be verified", async () => {
    const res = await techNews.GET(request("/api/tech-news", { method: "GET" }));
    assert.equal(res.status, 500);
    expectNoQuotaHeaders(res, "tech-news 500 IP_VERIFICATION_FAILED");
  });

  it("emits no quota headers on 405", async () => {
    const res = await techNews.POST();
    assert.equal(res.status, 405);
    expectNoQuotaHeaders(res, "tech-news 405");
  });
});

// ============================================================
// GET /api/ai/health
// ============================================================

describe("GET /api/ai/health rate-limit headers (AUD-09)", () => {
  let health: typeof import("../app/api/ai/health/route");

  before(async () => {
    health = await import("../app/api/ai/health/route");
  });

  it("exposes the quota on 200", async () => {
    healthDown = false;
    const res = await health.GET(request("/api/ai/health", { method: "GET", ip: "10.9.4.1" }));
    assert.equal(res.status, 200);
    expectQuotaHeaders(res, "ai/health 200", AI_HEALTH_LIMIT);
  });

  it("exposes the quota on 503", async () => {
    healthDown = true;
    try {
      const res = await health.GET(request("/api/ai/health", { method: "GET", ip: "10.9.4.2" }));
      assert.equal(res.status, 503);
      expectQuotaHeaders(res, "ai/health 503", AI_HEALTH_LIMIT);
    } finally {
      healthDown = false;
    }
  });

  it("returns 429 with Retry-After once the quota is exhausted", async () => {
    for (let i = 0; i < AI_HEALTH_LIMIT; i++) {
      const ok = await health.GET(request("/api/ai/health", { method: "GET", ip: "10.9.4.3" }));
      assert.equal(ok.status, 200);
    }
    const res = await health.GET(request("/api/ai/health", { method: "GET", ip: "10.9.4.3" }));
    assert.equal(res.status, 429);
    expectQuotaExceededHeaders(res, "ai/health 429");
  });

  it("emits no quota headers when the client IP cannot be verified", async () => {
    const res = await health.GET(request("/api/ai/health", { method: "GET" }));
    assert.equal(res.status, 500);
    expectNoQuotaHeaders(res, "ai/health 500 IP_VERIFICATION_FAILED");
  });
});

// ============================================================
// POST /api/interview/{start,submit,complete}
// ============================================================

type InterviewRoute = { POST: (request: NextRequest) => Promise<Response>; GET: () => Promise<Response> };

describe("interview routes rate-limit headers (AUD-09)", () => {
  let start: InterviewRoute;
  let submit: InterviewRoute;
  let complete: InterviewRoute;

  before(async () => {
    start = (await import("../app/api/interview/start/route")) as unknown as InterviewRoute;
    submit = (await import("../app/api/interview/submit/route")) as unknown as InterviewRoute;
    complete = (await import("../app/api/interview/complete/route")) as unknown as InterviewRoute;
  });

  const cases = [
    { name: "start", route: () => start, path: "/api/interview/start", limit: INTERVIEW_LIMIT, maxBody: 16_384 },
    { name: "submit", route: () => submit, path: "/api/interview/submit", limit: INTERVIEW_LIMIT, maxBody: 65_536 },
    { name: "complete", route: () => complete, path: "/api/interview/complete", limit: INTERVIEW_COMPLETE_LIMIT, maxBody: 16_384 },
  ] as const;

  for (const [index, testCase] of cases.entries()) {
    it(`${testCase.name}: exposes the quota on 413 PAYLOAD_TOO_LARGE`, async () => {
      const route = testCase.route();
      const res = await route.POST(
        requestWithContentLength(
          testCase.path,
          `10.9.5.${index + 1}`,
          String(testCase.maxBody + 1024),
        ),
      );
      assert.equal(res.status, 413);
      expectQuotaHeaders(res, `${testCase.name} 413`, testCase.limit);
    });

    it(`${testCase.name}: returns 429 with Retry-After once the quota is exhausted`, async () => {
      const route = testCase.route();
      const ip = `10.9.6.${index + 1}`;
      for (let i = 0; i < testCase.limit; i++) {
        const ok = await route.POST(postJson(testCase.path, "{}", ip));
        assert.notEqual(ok.status, 200, `request ${i + 1} must not succeed`);
        assert.notEqual(ok.status, 429, `request ${i + 1} must stay within the quota`);
        expectQuotaHeaders(ok, `${testCase.name} ${ok.status} (quota consumed)`);
      }
      const res = await route.POST(postJson(testCase.path, "{}", ip));
      assert.equal(res.status, 429);
      expectQuotaExceededHeaders(res, `${testCase.name} 429`);
    });

    it(`${testCase.name}: emits no quota headers when the client IP cannot be verified`, async () => {
      const route = testCase.route();
      const res = await route.POST(postJson(testCase.path, "{}"));
      assert.equal(res.status, 500);
      expectNoQuotaHeaders(res, `${testCase.name} 500 IP_VERIFICATION_FAILED`);
    });

    it(`${testCase.name}: emits no quota headers on 405`, async () => {
      const route = testCase.route();
      const res = await route.GET();
      assert.equal(res.status, 405);
      expectNoQuotaHeaders(res, `${testCase.name} 405`);
    });
  }

  it("start: exposes the quota on a malformed Content-Length (400)", async () => {
    const res = await start.POST(
      requestWithContentLength("/api/interview/start", "10.9.7.1", "not-a-number"),
    );
    assert.equal(res.status, 400);
    expectQuotaHeaders(res, "start 400 BAD_REQUEST", INTERVIEW_LIMIT);
  });
});
