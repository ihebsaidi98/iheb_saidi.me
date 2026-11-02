import assert from "node:assert/strict";
import { describe, it, before, beforeEach, afterEach, after } from "node:test";
import { NextRequest } from "next/server";
import { GREETING_RESPONSE } from "@/lib/chat";

describe("POST /api/chat — Rate Limiting & Proxy Tests", () => {
  let POST: typeof import("./route").POST;
  let GET: typeof import("./route").GET;
  const originalEnv = { ...process.env };

  before(async () => {
    // Guarantee default rate limit configuration (10 req / 60_000 ms) regardless of local or CI env
    delete process.env.CHAT_RATE_LIMIT;
    delete process.env.CHAT_RATE_WINDOW_MS;
    process.env.TRUSTED_PROXY = "true";

    const route = await import("./route");
    POST = route.POST;
    GET = route.GET;
  });

  beforeEach(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  afterEach(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  after(() => {
    // Restore original environment completely
    process.env = { ...originalEnv };
  });

  function createRequest(
    body: unknown,
    options: {
      ip?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const ip = options.ip ?? "10.0.1.1";
    return new NextRequest("http://localhost:3000/api/chat", {
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

  it("allows request when under rate limit and returns 200 with rate limit headers", async () => {
    const req = createRequest({ message: "Hello" }, { ip: "10.0.1.10" });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.reply, GREETING_RESPONSE);

    // Rate limit headers for an allowed request
    assert.equal(res.headers.get("X-RateLimit-Limit"), "10");
    assert.equal(res.headers.get("X-RateLimit-Remaining"), "9");
    assert.ok(res.headers.get("X-RateLimit-Reset"));
    assert.ok(Number(res.headers.get("X-RateLimit-Reset")) > 0);
    assert.equal(res.headers.get("Retry-After"), null);
  });

  it("decrements remaining counter with each request until limit is reached", async () => {
    const fixedIp = "10.0.1.20";

    for (let i = 0; i < 10; i++) {
      const res = await POST(createRequest({ message: "Hello" }, { ip: fixedIp }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-RateLimit-Remaining"), String(9 - i));
      assert.equal(res.headers.get("X-RateLimit-Limit"), "10");
    }
  });

  it("returns 429 RATE_LIMITED when rate limit threshold (10 requests) is exceeded", async () => {
    const fixedIp = "10.0.1.30";

    // Consume the 10 allowed requests in the window
    for (let i = 0; i < 10; i++) {
      const res = await POST(createRequest({ message: "Hello" }, { ip: fixedIp }));
      assert.equal(res.status, 200);
    }

    // 11th request exceeds the configured limit
    const blockedRes = await POST(createRequest({ message: "Hello" }, { ip: fixedIp }));
    assert.equal(blockedRes.status, 429);

    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.equal(
      data.error,
      "Too many requests. Please wait a moment before sending another message.",
    );

    // In POST /api/chat, retryAfterMs is NOT present in the JSON body (unlike interview routes)
    // The retry delay is exclusively communicated via the standard Retry-After HTTP header
    assert.equal((data as Record<string, unknown>).retryAfterMs, undefined);

    // Verify all rate limit response headers
    assert.equal(blockedRes.headers.get("X-RateLimit-Limit"), "10");
    assert.equal(blockedRes.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blockedRes.headers.get("X-RateLimit-Reset"));
    assert.ok(Number(blockedRes.headers.get("X-RateLimit-Reset")) > 0);

    const retryAfter = blockedRes.headers.get("Retry-After");
    assert.ok(retryAfter);
    const retryAfterSeconds = Number(retryAfter);
    assert.ok(retryAfterSeconds > 0 && retryAfterSeconds <= 60);
  });

  it("isolates rate limit counters between different IP addresses", async () => {
    const ipA = "10.0.1.40";
    const ipB = "10.0.1.41";

    // Exhaust quota for IP A
    for (let i = 0; i < 10; i++) {
      const res = await POST(createRequest({ message: "Hello" }, { ip: ipA }));
      assert.equal(res.status, 200);
    }

    const blockedA = await POST(createRequest({ message: "Hello" }, { ip: ipA }));
    assert.equal(blockedA.status, 429);

    // IP B should remain unaffected with its own fresh window
    const allowedB = await POST(createRequest({ message: "Hello" }, { ip: ipB }));
    assert.equal(allowedB.status, 200);
    assert.equal(allowedB.headers.get("X-RateLimit-Remaining"), "9");
  });

  it("returns 405 Method Not Allowed on GET with Allow header", async () => {
    const res = await GET();
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
    const data = await res.json();
    assert.equal(data.code, "METHOD_NOT_ALLOWED");
  });
});
