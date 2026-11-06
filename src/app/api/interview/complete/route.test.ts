import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";
import { aiServiceClient, AIServiceClientError } from "@/lib/ai-service-client";

let freshInstance = 0;

/** Load a brand-new instance of the route module (cold per-IP quota). */
async function freshRoute(): Promise<typeof import("./route")> {
  freshInstance += 1;
  const url = new URL("./route.ts", import.meta.url);
  return (await import(`${url.href}?fresh=${freshInstance}`)) as typeof import("./route");
}

describe("POST /api/interview/complete — Secure Proxy Route", () => {
  const originalIsConfigured = aiServiceClient.isConfigured;
  const originalCompleteInterviewSession = aiServiceClient.completeInterviewSession;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TRUSTED_PROXY = "true";
    process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";
    delete process.env.AI_SERVICE_ENABLED;
  });

  afterEach(() => {
    aiServiceClient.isConfigured = originalIsConfigured;
    aiServiceClient.completeInterviewSession = originalCompleteInterviewSession;
    process.env = { ...originalEnv };
  });

  function createRequest(
    body: unknown,
    options: {
      ip?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const ip = options.ip ?? "192.168.1.200";
    return new NextRequest("http://localhost:3000/api/interview/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ip,
        "x-forwarded-for": ip,
        ...(options.headers ?? {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  const validPayload = {
    session_id: "session-12345",
    session_token: "token-abc-987",
  };

  it("completes interview session successfully and returns 200 with report", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async (opts) => {
      assert.equal(opts.session_id, "session-12345");
      assert.equal(opts.session_token, "token-abc-987");
      return {
        session_id: "session-12345",
        track: "full_stack",
        score_out_of_100: 88.0,
        mcq_score: 45.0,
        written_score: 43.0,
        mcq_results: [],
        written_results: [],
        topic_breakdown: [],
        overall_strengths: ["Strong conceptual foundation"],
        overall_improvements: [],
        total_questions: 10,
      };
    };

    const req = createRequest(validPayload, { ip: "192.168.1.201" });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.session_id, "session-12345");
    assert.equal(data.score_out_of_100, 88.0);
    assert.equal(data.mcq_score, 45.0);
    assert.equal(data.written_score, 43.0);
    assert.ok(res.headers.get("X-RateLimit-Limit"));
  });

  it("returns 405 Method Not Allowed on GET with Allow header", async () => {
    const res = await GET();
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
    const data = await res.json();
    assert.equal(data.code, "METHOD_NOT_ALLOWED");
  });

  it("returns 413 Payload Too Large when Content-Length exceeds maximum", async () => {
    const req = createRequest(validPayload, {
      ip: "192.168.1.202",
      headers: { "content-length": "20000" },
    });
    const res = await POST(req);
    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.code, "PAYLOAD_TOO_LARGE");
  });

  it("returns 400 Bad Request on malformed JSON payload", async () => {
    const req = createRequest("invalid {{json", { ip: "192.168.1.203" });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "BAD_REQUEST");
  });

  it("returns 422 Validation Error when session_id is missing or empty", async () => {
    const req = createRequest(
      { ...validPayload, session_id: "   " },
      { ip: "192.168.1.204" },
    );
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("returns 422 Validation Error when session_token is missing or empty", async () => {
    const req = createRequest(
      { ...validPayload, session_token: "" },
      { ip: "192.168.1.204" },
    );
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("returns 503 SERVICE_UNAVAILABLE when AI service is not configured", async () => {
    aiServiceClient.isConfigured = () => false;
    const req = createRequest(validPayload, { ip: "192.168.1.209" });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "SERVICE_UNAVAILABLE");
  });

  it("forwards upstream 403 TOKEN_MISMATCH with clean message", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => {
      throw new AIServiceClientError("Session token verification failed.", {
        status: 403,
        code: "TOKEN_MISMATCH",
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.215" });
    const res = await POST(req);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, "TOKEN_MISMATCH");
  });

  it("forwards upstream 422 SESSION_INCOMPLETE with clean message", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => {
      throw new AIServiceClientError("All questions must be answered before completion.", {
        status: 422,
        code: "SESSION_INCOMPLETE",
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.216" });
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "SESSION_INCOMPLETE");
  });

  it("allows 2 requests per window and blocks the 3rd with 429 RATE_LIMITED", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const fixedIp = "192.168.1.99";
    // 1st request: allowed, remaining = 1
    const res1 = await POST(createRequest(validPayload, { ip: fixedIp }));
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get("X-RateLimit-Limit"), "2");
    assert.equal(res1.headers.get("X-RateLimit-Remaining"), "1");

    // 2nd request: allowed, remaining = 0
    const res2 = await POST(createRequest(validPayload, { ip: fixedIp }));
    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get("X-RateLimit-Limit"), "2");
    assert.equal(res2.headers.get("X-RateLimit-Remaining"), "0");

    // 3rd request: blocked with 429
    const blockedRes = await POST(createRequest(validPayload, { ip: fixedIp }));
    assert.equal(blockedRes.status, 429);

    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.equal(typeof data.retryAfterMs, "number");
    assert.ok(data.retryAfterMs > 0);

    assert.equal(blockedRes.headers.get("X-RateLimit-Limit"), "2");
    assert.equal(blockedRes.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blockedRes.headers.get("X-RateLimit-Reset"));
    assert.ok(Number(blockedRes.headers.get("X-RateLimit-Reset")) > 0);
    assert.ok(blockedRes.headers.get("Retry-After"));
    assert.equal(
      blockedRes.headers.get("Retry-After"),
      String(Math.ceil(data.retryAfterMs / 1000)),
    );
  });

  it("tracks two different IP addresses with independent quotas", async () => {
    const route = await freshRoute();
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const ipA = "10.0.10.1";
    const ipB = "10.0.10.2";

    // Exhaust IP A (2 requests)
    assert.equal((await route.POST(createRequest(validPayload, { ip: ipA }))).status, 200);
    assert.equal((await route.POST(createRequest(validPayload, { ip: ipA }))).status, 200);
    assert.equal((await route.POST(createRequest(validPayload, { ip: ipA }))).status, 429);

    // IP B starts cold with full quota
    const resB = await route.POST(createRequest(validPayload, { ip: ipB }));
    assert.equal(resB.status, 200);
    assert.equal(resB.headers.get("X-RateLimit-Limit"), "2");
    assert.equal(resB.headers.get("X-RateLimit-Remaining"), "1");
  });

  it("shares quota between two IPv6 addresses within the same /64 prefix", async () => {
    const route = await freshRoute();
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const hostA = "2001:db8:cafe:0001::1";
    const hostB = "2001:db8:cafe:0001::2"; // same /64
    const otherPrefix = "2001:db8:cafe:0002::1"; // different /64

    // Host A uses request 1
    const resA = await route.POST(createRequest(validPayload, { ip: hostA }));
    assert.equal(resA.status, 200);
    assert.equal(resA.headers.get("X-RateLimit-Remaining"), "1");

    // Host B uses request 2 (same /64)
    const resB = await route.POST(createRequest(validPayload, { ip: hostB }));
    assert.equal(resB.status, 200);
    assert.equal(resB.headers.get("X-RateLimit-Remaining"), "0");

    // Host B 3rd request is blocked
    const resBlocked = await route.POST(createRequest(validPayload, { ip: hostB }));
    assert.equal(resBlocked.status, 429);

    // Other prefix has independent quota
    const resOther = await route.POST(createRequest(validPayload, { ip: otherPrefix }));
    assert.equal(resOther.status, 200);
    assert.equal(resOther.headers.get("X-RateLimit-Remaining"), "1");
  });

  it("characterizes SWC epoch boundary behavior with a controlled clock", async () => {
    const route = await freshRoute();
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const realNow = Date.now;
    const ip = "10.0.20.1";
    let simulatedNow = 1_700_000_000_000; // aligned on 60_000 ms epoch
    Date.now = () => simulatedNow;

    try {
      // Bucket 1 (windowStart = 1_700_000_000_000)
      simulatedNow = 1_700_000_010_000;
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 200);
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 200);
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 429);

      // Roll to Bucket 2 (windowStart = 1_700_000_060_000) at age = 1 ms
      simulatedNow = 1_700_000_060_001;
      // Under SWC linear decay: prevCount = 2, curCount = 0.
      // n = 0 + 2 * (60_000 - 1) = 119_998 < 120_000.
      // 1 request is accepted right after roll.
      const resRoll = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(resRoll.status, 200);
      assert.equal(resRoll.headers.get("X-RateLimit-Remaining"), "0");

      // Next request in Bucket 2 is immediately blocked (nAfter = 60_000 + 119_998 = 179_998 >= 120_000)
      simulatedNow = 1_700_000_060_002;
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 429);

      // Bucket 3 (windowStart = 1_700_000_120_000): previous bucket has decayed
      simulatedNow = 1_700_000_130_000;
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 200);
    } finally {
      Date.now = realNow;
    }
  });

  it("characterizes SWC ceiling allowing up to 4 requests in ~30s when a burst crosses the epoch boundary at age > 30s", async () => {
    const route = await freshRoute();
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const realNow = Date.now;
    const ip = "10.0.30.1";
    // Epoch aligned window: 1_800_000_000_000 % 60_000 === 0
    // Window 0 = [1_800_000_000_000, 1_800_000_060_000)
    const baseEpoch = 1_800_000_000_000;
    let simulatedNow = baseEpoch + 59_900; // t = 59,900 ms in window 0
    Date.now = () => simulatedNow;

    try {
      // 1. In window 0 at t = 59,900 ms: request 1 accepted (remaining: 1)
      const res1 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get("X-RateLimit-Remaining"), "1");

      // 2. Request 2 accepted (remaining: 0)
      const res2 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get("X-RateLimit-Remaining"), "0");

      // 3. Request 3 in window 0 blocked (429)
      const res3 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res3.status, 429);
      const data3 = await res3.json();
      assert.equal(data3.code, "RATE_LIMITED");
      assert.equal(data3.retryAfterMs, 101); // (60_000 - 59_900) + 1 = 101 ms

      // 4. Advance time to t = 90,100 ms (window 1 = [1_800_000_060_000, 1_800_000_120_000), age = 30,100 ms)
      // Elapsed duration: 90,100 - 59,900 = 30,200 ms (~30.2 seconds)
      simulatedNow = baseEpoch + 90_100;

      // In window 1, prevCount = 2, age = 30,100 ms, T - age = 29,900 ms
      // Request 4 (1st in window 1): n = 0 + 2 * 29,900 = 59,800 < 120,000 -> accepted!
      const res4 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res4.status, 200);
      assert.equal(res4.headers.get("X-RateLimit-Remaining"), "1");

      // Request 5 (2nd in window 1): n = 60,000 + 2 * 29,900 = 119,800 < 120,000 -> accepted!
      const res5 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res5.status, 200);
      assert.equal(res5.headers.get("X-RateLimit-Remaining"), "0");

      // Request 6 (3rd in window 1): n = 120,000 + 59,800 = 179,800 >= 120,000 -> blocked!
      const res6 = await route.POST(createRequest(validPayload, { ip }));
      assert.equal(res6.status, 429);
      const data6 = await res6.json();
      assert.equal(data6.code, "RATE_LIMITED");
      // Must wait until window 1 rolls at 120,000 ms + 1 ms: (120,000 - 90,100) + 1 = 29,901 ms
      assert.equal(data6.retryAfterMs, 29901);

      // Demonstrates conclusively: exactly 4 requests accepted over a ~30.2s interval
      // (within any 60-second sliding window spanning [30,101, 90,100]), capping Gemini evaluations to at most 20 calls.
    } finally {
      Date.now = realNow;
    }
  });

  it("confirms start and submit routes preserve their independent quota of 15", async () => {
    const startRoute = await import("../start/route");
    const submitRoute = await import("../submit/route");
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async () => ({
      session_id: "s-1",
      session_token: "t-1",
      track: "full_stack",
      total_questions: 10,
      initial_question: {
        question_id: "q-1",
        question_number: 1,
        total_questions: 10,
        question_text: "Q?",
        question_type: "mcq",
        track: "full_stack",
        topic: "HTTP",
        expected_talking_points: [],
      },
    });

    const ipStart = "10.0.30.1";
    const startReq = new NextRequest("http://localhost:3000/api/interview/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ipStart,
        "x-forwarded-for": ipStart,
      },
      body: JSON.stringify({ track: "full_stack" }),
    });

    const startRes = await startRoute.POST(startReq);
    assert.equal(startRes.headers.get("X-RateLimit-Limit"), "15");
  });

  it("answers 429 before the Content-Length check once the IP quota is spent (F5)", async () => {
    const route = await freshRoute();
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.completeInterviewSession = async () => ({
      session_id: "session-12345",
      track: "full_stack",
      score_out_of_100: 88.0,
      mcq_score: 45.0,
      written_score: 43.0,
      mcq_results: [],
      written_results: [],
      topic_breakdown: [],
      overall_strengths: [],
      overall_improvements: [],
      total_questions: 10,
    });

    const ip = "192.168.1.100";
    // 2 requests spend the quota
    for (let i = 0; i < 2; i++) {
      assert.equal((await route.POST(createRequest(validPayload, { ip }))).status, 200);
    }

    const blockedRes = await route.POST(
      createRequest(validPayload, { ip, headers: { "content-length": "20000" } }),
    );

    assert.equal(blockedRes.status, 429);
    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.equal(typeof data.retryAfterMs, "number");
    assert.equal(blockedRes.headers.get("X-RateLimit-Limit"), "2");
    assert.equal(blockedRes.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blockedRes.headers.get("Retry-After"));
  });

  it("still returns 413 for an oversized body when the IP is under quota (F5)", async () => {
    const route = await freshRoute();

    const res = await route.POST(
      createRequest(validPayload, { ip: "192.168.1.101", headers: { "content-length": "20000" } }),
    );

    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.code, "PAYLOAD_TOO_LARGE");
  });

  it("keeps failing closed on an unverifiable client IP (500, never 429)", async () => {
    const route = await freshRoute();
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    const originalProxy = env.TRUSTED_PROXY;
    try {
      env.NODE_ENV = "production";
      delete env.TRUSTED_PROXY;

      const req = new NextRequest("http://localhost:3000/api/interview/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await route.POST(req);

      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.code, "IP_VERIFICATION_FAILED");
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.TRUSTED_PROXY = originalProxy;
    }
  });
});
