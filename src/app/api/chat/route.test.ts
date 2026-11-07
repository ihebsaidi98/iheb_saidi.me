import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it, before, beforeEach, afterEach, after, mock } from "node:test";
import { NextRequest } from "next/server";
import { GREETING_RESPONSE, INSUFFICIENT_EVIDENCE_REPLY, MAX_CHAT_BODY_SIZE } from "@/lib/chat";
import { PortfolioIndexManager } from "@/lib/rag";

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

    // F3: the retry delay is exposed in the body, like the interview routes
    // and /api/csp-report, so a client can back off without parsing headers.
    const retryAfterMs = (data as Record<string, unknown>).retryAfterMs;
    assert.equal(typeof retryAfterMs, "number");
    assert.ok(Number(retryAfterMs) > 0 && Number(retryAfterMs) <= 60_000);

    // Verify all rate limit response headers
    assert.equal(blockedRes.headers.get("X-RateLimit-Limit"), "10");
    assert.equal(blockedRes.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blockedRes.headers.get("X-RateLimit-Reset"));
    assert.ok(Number(blockedRes.headers.get("X-RateLimit-Reset")) > 0);

    const retryAfter = blockedRes.headers.get("Retry-After");
    assert.ok(retryAfter);
    const retryAfterSeconds = Number(retryAfter);
    assert.ok(retryAfterSeconds > 0 && retryAfterSeconds <= 60);
    assert.equal(retryAfterSeconds, Math.ceil(Number(retryAfterMs) / 1000));
  });

  it("exposes the remaining window in retryAfterMs on a 429 (F3)", async () => {
    const fixedNow = 1_700_000_000_500;
    const realNow = Date.now;
    Date.now = () => fixedNow;
    try {
      const ip = "10.0.1.31";
      for (let i = 0; i < 10; i++) {
        const res = await POST(createRequest({ message: "Hello" }, { ip }));
        assert.equal(res.status, 200);
      }

      const blocked = await POST(createRequest({ message: "Hello" }, { ip }));
      assert.equal(blocked.status, 429);
      const data = (await blocked.json()) as Record<string, unknown>;

      assert.equal(data.code, "RATE_LIMITED");
      // Under SWC epoch-aligned window:
      // windowStart = Math.floor(1_700_000_000_500 / 60_000) * 60_000 = 1_699_999_980_000 ms.
      // age = 20_500 ms. Time to window roll: 60_000 - 20_500 = 39_500 ms.
      // When curCount = limit, retryAfterMsAfterRoll adds 1 ms -> retryAfterMs = 39_501 ms.
      assert.equal(data.retryAfterMs, 39_501);
      // Retry-After header is Math.ceil(39_501 / 1000) = 40 seconds.
      assert.equal(blocked.headers.get("Retry-After"), "40");
      assert.equal(
        blocked.headers.get("Retry-After"),
        String(Math.ceil(Number(data.retryAfterMs) / 1000)),
      );
      assert.notEqual(
        blocked.headers.get("Retry-After"),
        String(Math.floor(Number(data.retryAfterMs) / 1000)),
      );
      assert.equal(blocked.headers.get("X-RateLimit-Limit"), "10");
      assert.equal(blocked.headers.get("X-RateLimit-Remaining"), "0");
      // resetAt = windowStart + 60_000 = 1_700_000_040_000 ms -> 1_700_000_040 s.
      assert.equal(blocked.headers.get("X-RateLimit-Reset"), "1700000040");
    } finally {
      Date.now = realNow;
    }
  });

  it("exposes the active epoch window reset timestamp in X-RateLimit-Reset (F4)", async () => {
    const fixedNow = 1_700_000_050_250;
    const realNow = Date.now;
    Date.now = () => fixedNow;
    try {
      const res = await POST(createRequest({ message: "Hello" }, { ip: "10.0.1.32" }));
      assert.equal(res.status, 200);

      // In production, windows are epoch-aligned:
      // windowStart = Math.floor(1_700_000_050_250 / 60_000) * 60_000 = 1_700_000_040_000 ms.
      // resetAt = windowStart + 60_000 = 1_700_000_100_000 ms.
      // Because windowMs (60_000 ms) is a multiple of 1_000 ms, resetAt % 1_000 is always 0.
      // Therefore, Math.ceil(resetAt / 1000) === Math.floor(resetAt / 1000) under real route configuration.
      const resetAtMs = Math.floor(fixedNow / 60_000) * 60_000 + 60_000;
      const expected = String(Math.ceil(resetAtMs / 1000));

      assert.equal(res.headers.get("X-RateLimit-Reset"), expected);
      assert.equal(res.headers.get("X-RateLimit-Reset"), "1700000100");
    } finally {
      Date.now = realNow;
    }
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

  it("shares one quota between two IPv6 addresses of the same /64 (F2)", async () => {
    const firstHost = "2001:db8:abcd:1234::1";
    const siblingHost = "2001:db8:abcd:1234::2";
    const otherPrefix = "2001:db8:abcd:1235::1";

    for (let i = 0; i < 10; i++) {
      const res = await POST(createRequest({ message: "Hello" }, { ip: firstHost }));
      assert.equal(res.status, 200);
    }

    // Rotating to another host inside the same /64 must not buy a fresh quota.
    const blocked = await POST(createRequest({ message: "Hello" }, { ip: siblingHost }));
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("X-RateLimit-Remaining"), "0");

    // A different /64 is a different subscriber and keeps its own window.
    const allowed = await POST(createRequest({ message: "Hello" }, { ip: otherPrefix }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("X-RateLimit-Remaining"), "9");
  });

  it("returns 405 Method Not Allowed on GET with Allow header", async () => {
    const res = await GET();
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
    const data = await res.json();
    assert.equal(data.code, "METHOD_NOT_ALLOWED");
  });
});

describe("POST /api/chat — Secret Redaction & Log Sanitization (Elements 2.6 & 3.2)", () => {
  let POST: typeof import("./route").POST;
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  before(async () => {
    process.env.TRUSTED_PROXY = "true";
    process.env.GEMINI_API_KEY = "AIzaSyFakeKeyForChatTest1234567890abcdef";
    const route = await import("./route");
    POST = route.POST;
  });

  after(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  function createRequest(
    body: unknown,
    options: {
      ip?: string;
    } = {},
  ) {
    const ip = options.ip ?? "10.0.99.1";
    return new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ip,
        "x-forwarded-for": ip,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("redacts secrets and sanitizes control characters during candidate fallback warnings (console.warn)", async () => {
    const warnLogs: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnLogs.push(args.map(String).join(" "));
    };

    let fetchCount = 0;
    const leakedKey = "AIzaSyD-1234567890abcdefghijklmnopqrstu";
    const leakedBearer = "Bearer secret_token_abc123";

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        return new Response(
          JSON.stringify({
            embeddings: [{ values: new Array(768).fill(0.01) }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        fetchCount++;
        if (fetchCount === 1) {
          // First candidate fails with a retryable error containing secrets and CR/LF
          const err = new Error(
            `503 UNAVAILABLE: Model overloaded key=${leakedKey}\r\nAuth: ${leakedBearer}\nAttempting next candidate`,
          );
          throw err;
        }

        // Second candidate (fallback) succeeds
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Java and Spring Boot are core skills." }],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createRequest(
        {
          message: "What backend experience does Iheb have?",
          history: [{ role: "user", content: "Hi" }],
        },
        { ip: "10.0.99.10" },
      );
      const res = await POST(req);

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.reply.includes("Java and Spring Boot"));

      // Check fallback warning log
      const fallbackWarning = warnLogs.find((l) => l.includes("attempting next fallback..."));
      assert.ok(fallbackWarning, "fallback warning must be logged");
      assert.ok(!fallbackWarning.includes(leakedKey), "raw API key must not leak into console.warn");
      assert.ok(
        fallbackWarning.includes("key=[REDACTED_API_KEY]"),
        "API key must be redacted with [REDACTED_API_KEY]",
      );
      assert.ok(
        !fallbackWarning.includes("secret_token_abc123"),
        "raw Bearer token must not leak into console.warn",
      );
      assert.ok(
        fallbackWarning.includes("Bearer [REDACTED_TOKEN]"),
        "Bearer token must be redacted with Bearer [REDACTED_TOKEN]",
      );
      assert.ok(!fallbackWarning.includes("\r"), "CR must be sanitized");
      assert.ok(!fallbackWarning.includes("\n"), "LF must be sanitized to prevent log splitting");
    } finally {
      console.warn = originalConsoleWarn;
      globalThis.fetch = originalFetch;
    }
  });

  it("redacts secrets and sanitizes control characters during global LLM failures (console.error)", async () => {
    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    const leakedKey = "AIzaSyD-9999999999abcdefghijklmnopqrstu";
    const leakedPassword = "password=SuperSecretPassword123!";

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        return new Response(
          JSON.stringify({
            embeddings: [{ values: new Array(768).fill(0.01) }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        throw new Error(
          `Fatal LLM failure: key=${leakedKey}\r\nQuery: ${leakedPassword}\n[500 Internal Server Error]`,
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createRequest(
        {
          message: "Can you summarize his background?",
          history: [{ role: "user", content: "Hi" }],
        },
        { ip: "10.0.99.11" },
      );
      const res = await POST(req);

      assert.equal(res.status, 502);
      const data = await res.json();
      assert.equal(data.code, "LLM_ERROR");
      assert.equal(data.error, "Failed to generate a response. Please try again.");

      // Ensure HTTP client response NEVER leaks secrets or upstream messages
      const serializedResponse = JSON.stringify(data);
      assert.ok(!serializedResponse.includes(leakedKey));
      assert.ok(!serializedResponse.includes("SuperSecretPassword123!"));

      // Check console.error log
      const errorLog = errorLogs.find((l) => l.includes("[chat/route] LLM call failed:"));
      assert.ok(errorLog, "LLM call failure must be logged to console.error");
      assert.ok(!errorLog.includes(leakedKey), "raw API key must not leak into console.error");
      assert.ok(
        errorLog.includes("key=[REDACTED_API_KEY]"),
        "API key must be redacted with [REDACTED_API_KEY]",
      );
      assert.ok(
        !errorLog.includes("SuperSecretPassword123!"),
        "password must not leak into console.error",
      );
      assert.ok(
        errorLog.includes("password=[REDACTED_SECRET]"),
        "password parameter must be redacted with [REDACTED_SECRET]",
      );
      assert.ok(!errorLog.includes("\r"), "CR must be sanitized");
      assert.ok(!errorLog.includes("\n"), "LF must be sanitized to prevent log splitting");
      assert.ok(errorLog.includes("[500 Internal Server Error]"), "diagnostic detail preserved");
    } finally {
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================
// AUD-02 — the chat body must be bounded BEFORE it is buffered.
//
// The cap is checked against the declared Content-Length when present and
// against the bytes actually pulled from the stream otherwise. These tests
// count pulled bytes rather than measuring heap: a handler that calls
// `request.json()` pulls everything and only then could compare sizes, so a
// full drain is observable even when the final status happens to be 413.
// ============================================================

describe("POST /api/chat — AUD-02 request body limit", () => {
  let POST: typeof import("./route").POST;
  const originalEnv = { ...process.env };

  before(async () => {
    delete process.env.CHAT_RATE_LIMIT;
    delete process.env.CHAT_RATE_WINDOW_MS;
    delete process.env.GEMINI_API_KEY;
    process.env.TRUSTED_PROXY = "true";
    POST = (await import("./route")).POST;
  });

  after(() => {
    process.env = { ...originalEnv };
  });

  type StreamProbe = { pulledBytes: number; cancelled: boolean };

  /** POST with a deterministic chunked stream and no Content-Length unless given. */
  function chunkedPost(
    bytes: Uint8Array,
    options: { ip: string; chunkSize?: number; contentLength?: string },
  ): { request: NextRequest; probe: StreamProbe } {
    const chunkSize = options.chunkSize ?? 1024;
    const probe: StreamProbe = { pulledBytes: 0, cancelled: false };
    let offset = 0;

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) {
          controller.close();
          return;
        }
        const end = Math.min(offset + chunkSize, bytes.byteLength);
        probe.pulledBytes += end - offset;
        controller.enqueue(bytes.subarray(offset, end));
        offset = end;
      },
      cancel() {
        probe.cancelled = true;
      },
    });

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-real-ip": options.ip,
      "x-forwarded-for": options.ip,
    };
    if (options.contentLength !== undefined) {
      headers["content-length"] = options.contentLength;
    }

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers,
      body: stream,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);

    return { request, probe };
  }

  /** Valid JSON of exactly `targetBytes` UTF-8 bytes (unknown keys are ignored). */
  function payloadOfSize(targetBytes: number): string {
    const overhead = Buffer.byteLength(JSON.stringify({ message: "hello", pad: "" }));
    const padding = targetBytes - overhead;
    assert.ok(padding >= 0, "target size must exceed the JSON overhead");
    const payload = JSON.stringify({ message: "hello", pad: "a".repeat(padding) });
    assert.equal(Buffer.byteLength(payload), targetBytes);
    return payload;
  }

  function plainPost(payload: string, ip: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ip,
        "x-forwarded-for": ip,
      },
      body: payload,
    });
  }

  it("accepts a valid payload of exactly the maximum size", async () => {
    const payload = payloadOfSize(MAX_CHAT_BODY_SIZE);
    const res = await POST(plainPost(payload, "10.0.3.1"));

    assert.equal(res.status, 200, "the cap must be inclusive");
    const data = (await res.json()) as { reply?: string };
    assert.equal(data.reply, GREETING_RESPONSE);
  });

  it("rejects a body one byte over the maximum with 413 PAYLOAD_TOO_LARGE", async () => {
    const bytes = new TextEncoder().encode(payloadOfSize(MAX_CHAT_BODY_SIZE + 1));
    const { request, probe } = chunkedPost(bytes, { ip: "10.0.3.2" });
    assert.equal(request.headers.get("content-length"), null);

    const res = await POST(request);

    assert.equal(res.status, 413);
    const data = (await res.json()) as { code?: string; error?: string };
    assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    assert.equal(
      data.error,
      `Payload too large. Maximum allowed size is ${MAX_CHAT_BODY_SIZE} bytes.`,
    );
    assert.equal(probe.cancelled, true, "the stream must be cancelled, not drained");
    assert.ok(
      probe.pulledBytes <= MAX_CHAT_BODY_SIZE + 2 * 1024,
      `consumed ${probe.pulledBytes} bytes for a ${bytes.byteLength}-byte body`,
    );
  });

  it("bounds a chunked body far above the cap instead of draining it", async () => {
    const bytes = new TextEncoder().encode(payloadOfSize(MAX_CHAT_BODY_SIZE * 3));
    const { request, probe } = chunkedPost(bytes, { ip: "10.0.3.3" });

    const res = await POST(request);

    assert.equal(res.status, 413);
    assert.ok(
      probe.pulledBytes < bytes.byteLength / 2,
      `handler pulled ${probe.pulledBytes}/${bytes.byteLength} bytes`,
    );
    assert.equal(probe.cancelled, true);
    assert.equal(request.body?.locked, false, "the reader lock must be released");
  });

  it("ignores a lying Content-Length and counts the real bytes", async () => {
    const bytes = new TextEncoder().encode(payloadOfSize(MAX_CHAT_BODY_SIZE * 2));
    const { request, probe } = chunkedPost(bytes, {
      ip: "10.0.3.4",
      contentLength: "10",
    });
    assert.equal(request.headers.get("content-length"), "10");

    const res = await POST(request);

    assert.equal(res.status, 413);
    assert.ok(
      probe.pulledBytes <= MAX_CHAT_BODY_SIZE + 2 * 1024,
      `a small header must not allow a full drain (pulled ${probe.pulledBytes})`,
    );
    assert.equal(probe.cancelled, true);
  });

  it("rejects an oversized declared Content-Length without reading the body", async () => {
    const bytes = new TextEncoder().encode(payloadOfSize(MAX_CHAT_BODY_SIZE * 2));
    const { request, probe } = chunkedPost(bytes, {
      ip: "10.0.3.5",
      contentLength: String(MAX_CHAT_BODY_SIZE * 2),
    });

    const res = await POST(request);

    assert.equal(res.status, 413);
    const data = (await res.json()) as { code?: string };
    assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    // A ReadableStream primes its queue with one chunk as soon as it is
    // constructed, so "the handler did not read" means no second chunk was
    // requested and the stream was never cancelled.
    assert.ok(
      probe.pulledBytes <= 1024,
      `the pre-flight must decide before reading (pulled ${probe.pulledBytes} bytes)`,
    );
    assert.equal(probe.cancelled, false);
  });

  it("releases the body lock after an accepted request", async () => {
    const { request } = chunkedPost(
      new TextEncoder().encode(JSON.stringify({ message: "hello" })),
      { ip: "10.0.3.6" },
    );

    const res = await POST(request);

    assert.equal(res.status, 200);
    assert.equal(request.body?.locked, false);
  });

  it("keeps the existing 400 INVALID_JSON contract for malformed JSON", async () => {
    const res = await POST(plainPost('{"message": "hi"', "10.0.3.7"));

    assert.equal(res.status, 400);
    const data = (await res.json()) as { code?: string; error?: string };
    assert.equal(data.code, "INVALID_JSON");
    assert.equal(data.error, "Request body must be valid JSON.");
  });

  it("keeps the existing 400 INVALID_JSON contract for an empty body", async () => {
    const res = await POST(plainPost("", "10.0.3.8"));

    assert.equal(res.status, 400);
    const data = (await res.json()) as { code?: string };
    assert.equal(data.code, "INVALID_JSON");
  });

  it("applies the quota before the body cap", async () => {
    const saturatedIp = "10.0.3.9";
    for (let i = 0; i < 10; i++) {
      const ok = await POST(plainPost(JSON.stringify({ message: "hello" }), saturatedIp));
      assert.equal(ok.status, 200, `request ${i + 1} should be accepted`);
    }

    const bytes = new TextEncoder().encode(payloadOfSize(MAX_CHAT_BODY_SIZE * 2));
    const { request, probe } = chunkedPost(bytes, {
      ip: saturatedIp,
      contentLength: String(MAX_CHAT_BODY_SIZE * 2),
    });

    const res = await POST(request);

    assert.equal(res.status, 429, "the quota is decided before the body is looked at");
    const data = (await res.json()) as { code?: string };
    assert.equal(data.code, "RATE_LIMITED");
    assert.ok(
      probe.pulledBytes <= 1024,
      `an over-quota request must not consume its body (pulled ${probe.pulledBytes} bytes)`,
    );
    assert.equal(probe.cancelled, false);
  });

  it("never reaches the AI layer when the body is oversized", async () => {
    // Control: with no GEMINI_API_KEY a small, non-greeting request reaches the
    // service-configuration guard and returns 503.
    const control = await POST(
      plainPost(
        JSON.stringify({ message: "Summarize his backend experience please" }),
        "10.0.3.10",
      ),
    );
    assert.equal(control.status, 503);
    assert.equal(
      ((await control.json()) as { code?: string }).code,
      "SERVICE_UNAVAILABLE",
    );

    const errorMock = mock.method(console, "error", () => undefined);
    try {
      const oversized = JSON.stringify({
        message: "Summarize his backend experience please",
        pad: "a".repeat(MAX_CHAT_BODY_SIZE),
      });
      const res = await POST(plainPost(oversized, "10.0.3.11"));

      assert.equal(res.status, 413, "the size gate must answer before the AI layer");
      assert.equal(errorMock.mock.callCount(), 0, "no AI key/RAG error may be logged");
    } finally {
      errorMock.mock.restore();
    }
  });
});

describe("POST /api/chat — Phase 5B: RAG Integration & Retrieval Error Contracts", () => {
  let POST: typeof import("./route").POST;
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  before(async () => {
    process.env.TRUSTED_PROXY = "true";
    process.env.GEMINI_API_KEY = "AIzaSyFakeKeyForPhase5BTests123456789";
    const route = await import("./route");
    POST = route.POST;
  });

  after(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  function createChatRequest(
    body: unknown,
    options: { ip?: string; headers?: Record<string, string> } = {},
  ) {
    const ip = options.ip ?? "10.0.150.1";
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

  it("returns 502 RETRIEVAL_ERROR when RAG retrieval fails", async () => {
    let llmCalls = 0;
    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        throw new Error("Simulated query embedding failure during RAG retrieval");
      }
      if (url.includes("generateContent")) {
        llmCalls++;
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createChatRequest(
        { message: "What technologies does Iheb work with in production?" },
        { ip: "10.0.150.10" },
      );
      const res = await POST(req);

      assert.equal(res.status, 502);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.code, "RETRIEVAL_ERROR");
      assert.equal(
        data.error,
        "Failed to retrieve portfolio context. Please try again.",
      );

      // Verify rate limit headers are attached
      assert.equal(res.headers.get("X-RateLimit-Limit"), "10");
      assert.ok(res.headers.get("X-RateLimit-Remaining"));
      assert.ok(res.headers.get("X-RateLimit-Reset"));

      // Verify LLM generation is never reached
      assert.equal(llmCalls, 0, "LLM must not be called when retrieval fails");

      // Verify error was logged
      assert.ok(
        errorLogs.some((l) => l.includes("[chat/route] RAG retrieval failed:")),
        "retrieval failure must be logged to console.error",
      );
    } finally {
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 400 INVALID_REQUEST for semantically invalid JSON payloads", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls++;
      return originalFetch(input, init);
    }) as typeof fetch;

    const invalidPayloads: { body: unknown; ip: string; desc: string }[] = [
      { body: { message: "" }, ip: "10.0.150.21", desc: "empty message" },
      {
        body: { message: "a".repeat(600) },
        ip: "10.0.150.22",
        desc: "oversized message > 500 chars",
      },
      { body: { message: 123 }, ip: "10.0.150.23", desc: "non-string message" },
      {
        body: { message: "Valid question", history: "invalid-history" },
        ip: "10.0.150.24",
        desc: "non-array history",
      },
    ];

    try {
      for (const { body, ip, desc } of invalidPayloads) {
        const req = createChatRequest(body, { ip });
        const res = await POST(req);

        assert.equal(res.status, 400, `Expected 400 for ${desc}`);
        const data = (await res.json()) as Record<string, unknown>;
        assert.equal(
          data.code,
          "INVALID_REQUEST",
          `Expected INVALID_REQUEST for ${desc}`,
        );
        assert.ok(
          typeof data.error === "string" && data.error.length > 0,
          `Error description must be present for ${desc}`,
        );

        // Rate limit headers must still be attached
        assert.equal(res.headers.get("X-RateLimit-Limit"), "10");
        assert.ok(res.headers.get("X-RateLimit-Remaining"));
        assert.ok(res.headers.get("X-RateLimit-Reset"));
      }

      // Neither RAG retrieval nor LLM should be invoked
      assert.equal(
        fetchCalls,
        0,
        "No network / Gemini calls may occur for invalid requests",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("passes chunk.text rather than searchText to the Gemini request", async () => {
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const previousRecords = manager.getStore().exportRecords();

    const controlledFactualText =
      "Iheb Saidi is a Full Stack Engineer specialized in Java, Spring Boot, and Angular.";
    const privateMarker = "PRIVATE_SEARCH_METADATA_MARKER_TEST_5B";
    const controlledSearchText = `Controlled Title project java spring boot ${privateMarker}`;

    let llmCalls = 0;
    let capturedLlmRequestBody = "";

    try {
      // Configure vector store with a controlled chunk having distinct text and searchText
      manager.getStore().clear();
      manager.getStore().loadRecords([
        {
          id: "controlled-chunk-5b-0",
          documentId: "controlled-doc-5b",
          type: "skills",
          title: "Controlled Skills Summary",
          summary: "Controlled skills summary for testing",
          text: controlledFactualText,
          searchText: controlledSearchText,
          source: "src/data/skills.ts",
          tags: ["skills", "backend"],
          metadata: {
            type: "skills",
            title: "Controlled Skills Summary",
            summary: "Controlled summary",
            source: "src/data/skills.ts",
            visibility: "public",
          },
          vector: new Array(768).fill(0.05),
        },
      ]);

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
          // Return a vector aligned with the controlled chunk
          return new Response(
            JSON.stringify({
              embeddings: [{ values: new Array(768).fill(0.05) }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("generateContent")) {
          llmCalls++;
          capturedLlmRequestBody = typeof init?.body === "string" ? init.body : "";
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: "Iheb Saidi works with Java and Spring Boot." }],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return originalFetch(input, init);
      }) as typeof fetch;

      const req = createChatRequest(
        { message: "What are Iheb's primary backend technologies?" },
        { ip: "10.0.150.30" },
      );
      const res = await POST(req);

      assert.equal(res.status, 200);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.reply, "Iheb Saidi works with Java and Spring Boot.");

      // Verify LLM was called exactly once
      assert.equal(llmCalls, 1, "LLM must be called exactly once");

      // Verify chunk.text is present in prompt payload
      assert.ok(
        capturedLlmRequestBody.includes(controlledFactualText),
        "LLM payload must contain chunk.text",
      );

      // Verify searchText marker NEVER leaked into the prompt payload
      assert.ok(
        !capturedLlmRequestBody.includes(privateMarker),
        "LLM payload must NOT contain private searchText metadata",
      );
    } finally {
      globalThis.fetch = originalFetch;
      manager.getStore().clear();
      manager.getStore().loadRecords(previousRecords);
    }
  });

  it("handles missing or incompatible index by returning 502 RETRIEVAL_ERROR without implicit index rebuilding", async () => {
    const manager = PortfolioIndexManager.getInstance();
    let networkCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      networkCalls++;
      return originalFetch(input, init);
    }) as typeof fetch;

    const warnLogs: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnLogs.push(args.map(String).join(" "));
    };
    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    const cleanups: (() => void)[] = [];

    try {
      // Sub-case 1: Incompatible strategyVersion on index file
      try {
        manager.reset();
        const origReadFileSync = fs.readFileSync;
        const readMethodMock = mock.method(fs, "readFileSync", (filePath: fs.PathOrFileDescriptor, options?: any) => {
          if (String(filePath).includes("rag-index.json")) {
            return JSON.stringify({
              version: 1,
              strategyVersion: 999, // Incompatible strategy version
              model: "gemini-embedding-001",
              dimensions: 768,
              recordsCount: 1,
              records: [{ id: "fake-0", vector: new Array(768).fill(0.01) }],
            });
          }
          return origReadFileSync.call(fs, filePath, options);
        });
        cleanups.push(() => readMethodMock.mock.restore());

        const reqIncompatible = createChatRequest(
          { message: "What projects did Iheb complete?" },
          { ip: "10.0.150.41" },
        );
        const resIncompatible = await POST(reqIncompatible);

        assert.equal(resIncompatible.status, 502);
        const dataIncompatible = (await resIncompatible.json()) as Record<string, unknown>;
        assert.equal(dataIncompatible.code, "RETRIEVAL_ERROR");
        assert.equal(
          networkCalls,
          0,
          "No network calls permitted (no implicit document re-embedding on stale index)",
        );
        assert.equal(manager.isInitialized(), false);
        assert.equal(manager.getStore().size(), 0);
      } finally {
        const cleanup = cleanups.pop();
        if (cleanup) cleanup();
      }

      // Sub-case 2: Missing index file
      try {
        manager.reset();
        const origExistsSync = fs.existsSync;
        const existsMethodMock = mock.method(fs, "existsSync", (filePath: fs.PathLike) => {
          if (String(filePath).includes("rag-index.json")) {
            return false;
          }
          return origExistsSync.call(fs, filePath);
        });
        cleanups.push(() => existsMethodMock.mock.restore());

        const reqMissing = createChatRequest(
          { message: "Where did Iheb work as an engineer?" },
          { ip: "10.0.150.42" },
        );
        const resMissing = await POST(reqMissing);

        assert.equal(resMissing.status, 502);
        const dataMissing = (await resMissing.json()) as Record<string, unknown>;
        assert.equal(dataMissing.code, "RETRIEVAL_ERROR");
        assert.equal(
          networkCalls,
          0,
          "No network calls permitted (no implicit index creation on missing index)",
        );
        assert.equal(manager.isInitialized(), false);
        assert.equal(manager.getStore().size(), 0);
      } finally {
        const cleanup = cleanups.pop();
        if (cleanup) cleanup();
      }
    } finally {
      while (cleanups.length > 0) {
        try {
          const cleanup = cleanups.pop();
          if (cleanup) cleanup();
        } catch {
          // ignore error during cleanup
        }
      }
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
      manager.reset();
      await manager.initialize(); // Restore production index in memory
    }
  });

  it("loads valid precomputed index with 39 records during POST request without document re-embedding", async () => {
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const sampleVector = manager.getStore().exportRecords()[0]?.vector ?? new Array(768).fill(0.01);
    manager.reset();

    let queryEmbeddingCalls = 0;
    let documentEmbeddingCalls = 0;
    let generateContentCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        const bodyStr = typeof init?.body === "string" ? init.body : "";
        if (bodyStr.includes("RETRIEVAL_DOCUMENT")) {
          documentEmbeddingCalls++;
        } else {
          queryEmbeddingCalls++;
        }
        return new Response(
          JSON.stringify({
            embeddings: [{ values: sampleVector }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        generateContentCalls++;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Iheb Saidi specializes in Java, Spring Boot, and Angular." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createChatRequest(
        { message: "What technologies does Iheb work with in production?" },
        { ip: "10.0.150.51" },
      );
      const res = await POST(req);

      assert.equal(res.status, 200);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(
        data.reply,
        "Iheb Saidi specializes in Java, Spring Boot, and Angular.",
      );

      // Verify that the manager loaded all 39 records from the precomputed index file
      assert.equal(manager.isInitialized(), true);
      assert.equal(
        manager.getStore().size(),
        39,
        "All 39 records from src/data/rag-index.json must be loaded",
      );

      // Verify query embedding vs document embedding counts
      assert.equal(
        queryEmbeddingCalls,
        1,
        "Exactly one query embedding call for the user's question",
      );
      assert.equal(
        documentEmbeddingCalls,
        0,
        "Zero document embeddings may be computed (no on-demand chunk embedding)",
      );
      assert.equal(
        generateContentCalls,
        1,
        "Exactly one LLM generation call",
      );
    } finally {
      globalThis.fetch = originalFetch;
      manager.reset();
      await manager.initialize();
    }
  });

  it("reuses already initialized index across multiple POST requests without reloading or re-embedding", async () => {
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const sampleVector = manager.getStore().exportRecords()[0]?.vector ?? new Array(768).fill(0.01);
    manager.reset();

    let readIndexCallCount = 0;
    const origReadFileSync = fs.readFileSync;
    let readMock: { mock: { restore: () => void } } | null = null;

    let queryEmbeddingCalls = 0;
    let documentEmbeddingCalls = 0;
    let generateContentCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        const bodyStr = typeof init?.body === "string" ? init.body : "";
        if (bodyStr.includes("RETRIEVAL_DOCUMENT")) {
          documentEmbeddingCalls++;
        } else {
          queryEmbeddingCalls++;
        }
        return new Response(
          JSON.stringify({
            embeddings: [{ values: sampleVector }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        generateContentCalls++;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Verified response for repeated request." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      readMock = mock.method(fs, "readFileSync", (filePath: fs.PathOrFileDescriptor, options?: any) => {
        if (String(filePath).includes("rag-index.json")) {
          readIndexCallCount++;
        }
        return origReadFileSync.call(fs, filePath, options);
      });

      // Request 1: Fresh singleton, should initialize from precomputed index file
      const req1 = createChatRequest(
        { message: "What backend stack does Iheb use?" },
        { ip: "10.0.160.10" },
      );
      const res1 = await POST(req1);
      assert.equal(res1.status, 200);
      assert.equal(manager.isInitialized(), true);
      assert.equal(manager.getStore().size(), 39);
      assert.equal(
        readIndexCallCount,
        1,
        "First request must read rag-index.json exactly once",
      );

      // Request 2: Singleton is already initialized, must reuse existing in-memory store
      const req2 = createChatRequest(
        { message: "What frontend stack does Iheb use?" },
        { ip: "10.0.160.20" }, // Distinct IP to avoid rate limit interference
      );
      const res2 = await POST(req2);
      assert.equal(res2.status, 200);
      assert.equal(manager.isInitialized(), true);
      assert.equal(manager.getStore().size(), 39);
      assert.equal(
        readIndexCallCount,
        1,
        "Second request must NOT re-read rag-index.json from disk",
      );

      // Verify overall network embedding counts across both requests
      assert.equal(
        queryEmbeddingCalls,
        2,
        "Each request embeds only its own user query (2 total)",
      );
      assert.equal(
        documentEmbeddingCalls,
        0,
        "No document re-embedding across either request",
      );
      assert.equal(
        generateContentCalls,
        2,
        "Both requests invoke the LLM with grounded context",
      );
    } finally {
      readMock?.mock.restore();
      globalThis.fetch = originalFetch;
      manager.reset();
      await manager.initialize();
    }
  });

  it("returns 504 TIMEOUT when LLM generation times out", async () => {
    let generateContentCalls = 0;
    const originalFetch = globalThis.fetch;
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const sampleVector = manager.getStore().exportRecords()[0]?.vector ?? new Array(768).fill(0.01);

    const warnLogs: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnLogs.push(args.map(String).join(" "));
    };
    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        return new Response(
          JSON.stringify({
            embeddings: [{ values: sampleVector }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        generateContentCalls++;
        const timeoutErr = new Error("The operation was aborted due to timeout");
        timeoutErr.name = "AbortError";
        throw timeoutErr;
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createChatRequest(
        { message: "What architectures did Iheb build?" },
        { ip: "10.0.170.10" },
      );
      const res = await POST(req);

      assert.equal(res.status, 504);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.code, "TIMEOUT");
      assert.equal(
        data.error,
        "The request timed out. Please try again.",
      );
      assert.equal(
        generateContentCalls,
        1,
        "Timeout must abort immediately without trying model fallbacks",
      );
    } finally {
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 200 with INSUFFICIENT_EVIDENCE_REPLY when no relevant chunks match and history is empty", async () => {
    let queryEmbeddingCalls = 0;
    let generateContentCalls = 0;
    const originalFetch = globalThis.fetch;
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const sampleVector = manager.getStore().exportRecords()[0]?.vector ?? new Array(768).fill(0.01);
    // Negated vector guarantees negative cosine similarity against all positive/normalized embeddings
    const oppositeVector = sampleVector.map((v) => -v);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        queryEmbeddingCalls++;
        return new Response(
          JSON.stringify({
            embeddings: [{ values: oppositeVector }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        generateContentCalls++;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "This should never be reached." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createChatRequest(
        { message: "Tell me about quantum cooking recipes." },
        { ip: "10.0.170.20" },
      );
      const res = await POST(req);

      assert.equal(res.status, 200);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(
        data.reply,
        INSUFFICIENT_EVIDENCE_REPLY,
        "Must return standard abstention message when evidence is insufficient",
      );
      assert.equal(
        queryEmbeddingCalls,
        1,
        "Exactly 1 query embedding call to evaluate relevance",
      );
      assert.equal(
        generateContentCalls,
        0,
        "LLM generateContent must NOT be invoked on complete retrieval abstention",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("halts fallback chain immediately on permanent LLM error (401/403) with HTTP 502", async () => {
    let generateContentCalls = 0;
    const originalFetch = globalThis.fetch;
    const manager = PortfolioIndexManager.getInstance();
    await manager.initialize();
    const sampleVector = manager.getStore().exportRecords()[0]?.vector ?? new Array(768).fill(0.01);

    const warnLogs: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnLogs.push(args.map(String).join(" "));
    };
    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("embedContent") || url.includes("batchEmbedContents")) {
        return new Response(
          JSON.stringify({
            embeddings: [{ values: sampleVector }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("generateContent")) {
        generateContentCalls++;
        // Simulate a 401 Unauthorized permanent failure from Gemini API
        return new Response(
          JSON.stringify({
            error: {
              code: 401,
              message: "API_KEY_INVALID: The provided API key is invalid or expired.",
              status: "UNAUTHENTICATED",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const req = createChatRequest(
        { message: "What cloud platforms does Iheb use?" },
        { ip: "10.0.170.30" },
      );
      const res = await POST(req);

      assert.equal(res.status, 502);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.code, "LLM_ERROR");
      assert.equal(
        data.error,
        "Failed to generate a response. Please try again.",
      );
      assert.equal(
        generateContentCalls,
        1,
        "Permanent 401 error must NOT iterate over fallback candidate models",
      );
    } finally {
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 503 SERVICE_UNAVAILABLE when GEMINI_API_KEY is not configured", async () => {
    let networkCalls = 0;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;

    const errorLogs: string[] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      networkCalls++;
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      delete process.env.GEMINI_API_KEY;

      const req = createChatRequest(
        { message: "Tell me about Iheb's architecture experience." },
        { ip: "10.0.170.40" },
      );
      const res = await POST(req);

      assert.equal(res.status, 503);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.code, "SERVICE_UNAVAILABLE");
      assert.equal(
        data.error,
        "The chat service is not configured. Please contact the site owner.",
      );
      assert.equal(
        networkCalls,
        0,
        "No network calls to embedding or LLM may be made when API key is missing",
      );
      assert.ok(
        errorLogs.some((log) => log.includes("GEMINI_API_KEY is not set")),
        "Expected error log about missing GEMINI_API_KEY",
      );
    } finally {
      if (originalApiKey !== undefined) {
        process.env.GEMINI_API_KEY = originalApiKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });
});
