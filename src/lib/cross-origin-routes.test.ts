/**
 * src/lib/cross-origin-routes.test.ts
 *
 * AUD-12 — cross-origin policy applied to the mutating API routes.
 *
 * These tests assert the *route-level* contract:
 *   - a browser request coming from another origin is rejected with
 *     403 CROSS_ORIGIN_REJECTED before any work happens (no quota, no body
 *     read, no AI call);
 *   - the real frontend (`fetch("/api/...")`, same origin) is still served;
 *   - a client that sends no browser metadata at all (curl, monitoring,
 *     server-to-server, Playwright's request API) is still served;
 *   - non-mutating handlers are untouched.
 *
 * The 403 assertions are the regression tests for AUD-12 and fail on the
 * pre-fix code (which had no origin check at all).
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/cross-origin-routes.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST as chatPost, GET as chatGet } from "@/app/api/chat/route";
import { POST as cspReportPost, GET as cspReportGet } from "@/app/api/csp-report/route";
import { POST as startPost, GET as startGet } from "@/app/api/interview/start/route";
import { POST as submitPost, GET as submitGet } from "@/app/api/interview/submit/route";
import { POST as completePost, GET as completeGet } from "@/app/api/interview/complete/route";
import { POST as techNewsPost, GET as techNewsGet } from "@/app/api/tech-news/route";

type Handler = (request: NextRequest) => Promise<Response>;

type MutatingRoute = {
  name: string;
  url: string;
  handler: Handler;
  contentType: string;
  body: string;
  /** Status the same-origin frontend gets with this payload (existing contract). */
  expectedStatus: number;
  expectedCode: string;
};

const MUTATING_ROUTES: MutatingRoute[] = [
  {
    name: "POST /api/chat",
    url: "http://localhost:3000/api/chat",
    handler: chatPost as unknown as Handler,
    contentType: "application/json",
    body: "",
    expectedStatus: 400,
    expectedCode: "INVALID_JSON",
  },
  {
    name: "POST /api/csp-report",
    url: "http://localhost:3000/api/csp-report",
    handler: cspReportPost as unknown as Handler,
    contentType: "application/csp-report",
    body: "{}",
    expectedStatus: 204,
    expectedCode: "",
  },
  {
    name: "POST /api/interview/start",
    url: "http://localhost:3000/api/interview/start",
    handler: startPost as unknown as Handler,
    contentType: "application/json",
    body: "{}",
    expectedStatus: 503,
    expectedCode: "SERVICE_UNAVAILABLE",
  },
  {
    name: "POST /api/interview/submit",
    url: "http://localhost:3000/api/interview/submit",
    handler: submitPost as unknown as Handler,
    contentType: "application/json",
    body: "{}",
    expectedStatus: 422,
    expectedCode: "VALIDATION_ERROR",
  },
  {
    name: "POST /api/interview/complete",
    url: "http://localhost:3000/api/interview/complete",
    handler: completePost as unknown as Handler,
    contentType: "application/json",
    body: "{}",
    expectedStatus: 422,
    expectedCode: "VALIDATION_ERROR",
  },
];

let ipCounter = 0;

function post(
  route: MutatingRoute,
  headers: Record<string, string> = {},
  ip?: string,
): Promise<Response> {
  const ipAddress = ip ?? `10.12.0.${++ipCounter}`;
  const request = new NextRequest(route.url, {
    method: "POST",
    headers: {
      "content-type": route.contentType,
      "x-real-ip": ipAddress,
      "x-forwarded-for": ipAddress,
      ...headers,
    },
    body: route.body,
  });
  return route.handler(request);
}

describe("AUD-12 — mutating routes reject cross-origin browser requests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TRUSTED_PROXY = "true";
    // Force the interview routes down their "not configured" path: no network.
    delete process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  for (const route of MUTATING_ROUTES) {
    describe(route.name, () => {
      it("rejects an Origin from another site with 403 CROSS_ORIGIN_REJECTED", async () => {
        const res = await post(route, { origin: "https://evil.example" });
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, "CROSS_ORIGIN_REJECTED");
        assert.equal(typeof body.error, "string");
        assert.equal(JSON.stringify(body).includes("evil.example"), false, "the origin must not be echoed");
      });

      it("rejects a cross-site request even when it forges our own Origin", async () => {
        const res = await post(route, {
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
        });
        assert.equal(res.status, 403);
        assert.equal((await res.json()).code, "CROSS_ORIGIN_REJECTED");
      });

      it("rejects the opaque 'null' origin", async () => {
        const res = await post(route, { origin: "null" });
        assert.equal(res.status, 403);
      });

      it("rejects a malformed Origin", async () => {
        const res = await post(route, { origin: "http://" });
        assert.equal(res.status, 403);
      });

      it("still serves the frontend's own origin (same-origin fetch)", async () => {
        const res = await post(route, { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" });
        assert.equal(res.status, route.expectedStatus, "a same-origin request must not be blocked");
      });

      it("still serves a client that sends no Origin at all (curl, monitoring)", async () => {
        const res = await post(route, {});
        assert.equal(res.status, route.expectedStatus);
      });

      it("keeps the existing JSON error contract on the served path", async () => {
        if (route.expectedCode === "" || route.expectedStatus === 204) return;
        const res = await post(route, { origin: "http://localhost:3000" });
        assert.equal((await res.json()).code, route.expectedCode);
      });

      it("emits no quota headers on the rejection (the quota is not consumed)", async () => {
        const res = await post(route, { origin: "https://evil.example" });
        assert.equal(res.status, 403);
        for (const header of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
          assert.equal(res.headers.get(header), null);
        }
      });
    });
  }

  it("does not consume the quota with rejected cross-origin requests", async () => {
    // CHAT_RATE_LIMIT defaults to 10 per window; burn 10 rejections from one IP,
    // then send the first legitimate request from that same IP.
    const ip = "10.12.9.9";
    const chat = MUTATING_ROUTES[0];
    for (let i = 0; i < 10; i++) {
      const rejected = await post(chat, { origin: "https://evil.example" }, ip);
      assert.equal(rejected.status, 403);
    }
    const legit = await post(chat, {}, ip);
    assert.equal(legit.status, 400, "the first legitimate request must not be rate limited");
    assert.equal(legit.headers.get("x-ratelimit-remaining"), "9");
  });

  it("leaves non-mutating handlers untouched", async () => {
    // Wrong-method handlers are constant 405s; they must not be turned into 403s.
    const responses = await Promise.all([chatGet(), cspReportGet(), startGet(), submitGet(), completeGet()]);
    for (const res of responses) {
      assert.equal(res.status, 405);
    }
    assert.equal((await techNewsPost()).status, 405);
    // The public read endpoint stays reachable (no origin guard on GET routes).
    assert.equal(typeof techNewsGet, "function");
  });
});
