import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";

import { POST, GET } from "./route";
import { sanitizeCspReportData } from "@/lib/csp-report";

// M2-02: application-level body cap (bytes).
const MAX_BODY_BYTES = 16 * 1024;
// M2-04: default quota from createRouteRateLimiter("CSP_REPORT_RATE_LIMIT", 60, …).
const RATE_LIMIT = 60;

const originalTrustedProxy = process.env.TRUSTED_PROXY;

function post(
  body: string | null,
  options: { ip?: string; contentType?: string; contentLength?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
    "x-forwarded-for": options.ip ?? "203.0.113.10",
  };
  if (options.contentLength !== undefined) headers["content-length"] = options.contentLength;
  return new NextRequest("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers,
    ...(body === null ? {} : { body }),
  });
}

/**
 * POST with a body sent as a stream (chunked or with a lying Content-Length).
 *
 * `request.body.locked` is the signal used by the tests to prove whether the
 * handler consumed the body: it stays `false` when the handler returns without
 * taking a reader, and becomes `true` as soon as it reads (and cancels).
 * Counting stream pulls is not usable here: the platform prefetches one chunk
 * asynchronously right after the request is constructed.
 */
function postStream(
  sizeBytes: number,
  options: { ip?: string; contentLength?: string } = {},
): { request: NextRequest } {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("a".repeat(sizeBytes)));
      controller.close();
    },
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": options.ip ?? "203.0.113.11",
  };
  if (options.contentLength !== undefined) headers["content-length"] = options.contentLength;

  const request = new NextRequest("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);

  return { request };
}

/** Build a valid CSP report whose UTF-8 byte length is exactly `targetBytes`. */
function reportOfExactSize(targetBytes: number): string {
  const template = (padding: number) =>
    JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(padding) } });
  const overhead = template(0).length;
  assert.ok(targetBytes > overhead, "target size must exceed the JSON overhead");
  return template(targetBytes - overhead);
}

describe("POST /api/csp-report — VULN-02 CSP Violation Ingestion & Secret Redaction", () => {
  before(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  after(() => {
    if (originalTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = originalTrustedProxy;
  });

  it("redacts sensitive tokens, API keys, and bearer tokens from reported strings", () => {
    const raw = "https://iheb-saidi.dev/test?key=AIzaSyD-1234567890abcdefghijklmnopqrstu&token=mysecrettoken with Bearer eyJhbGciOi";
    const sanitized = sanitizeCspReportData(raw);

    assert.ok(!sanitized.includes("AIzaSyD-1234567890abcdefghijklmnopqrstu"));
    assert.ok(sanitized.includes("[REDACTED_API_KEY]"));
    assert.ok(!sanitized.includes("mysecrettoken"));
    assert.ok(sanitized.includes("token=[REDACTED_SECRET]"));
    assert.ok(!sanitized.includes("eyJhbGciOi"));
    assert.ok(sanitized.includes("Bearer [REDACTED_TOKEN]"));
  });

  it("accepts valid CSP report with application/csp-report and returns 204 No Content", async () => {
    const payload = JSON.stringify({
      "csp-report": {
        "document-uri": "https://iheb-saidi.dev/",
        "referrer": "",
        "violated-directive": "script-src",
        "effectiveDirective": "script-src",
        "blocked-uri": "https://evil-attacker.com/malicious.js",
      },
    });

    const response = await POST(post(payload, { contentType: "application/csp-report" }));
    assert.equal(response.status, 204);
  });

  it("accepts JSON report with application/json and returns 204 No Content", async () => {
    const payload = JSON.stringify([
      {
        type: "csp-violation",
        body: {
          blockedURL: "https://evil.com/xss.js",
          effectiveDirective: "script-src-elem",
        },
      },
    ]);

    const response = await POST(post(payload));
    assert.equal(response.status, 204);
  });

  it("rejects unsupported media type with 415", async () => {
    const response = await POST(post("plain text violation", { contentType: "text/plain" }));
    assert.equal(response.status, 415);
  });

  it("rejects GET requests with 405 Method Not Allowed and sets Allow header", async () => {
    const response = await GET();
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });

  it("still accepts an empty body with 204", async () => {
    const response = await POST(post(null, { ip: "203.0.113.12" }));
    assert.equal(response.status, 204);
  });
});

describe("POST /api/csp-report — M2-02 body size limit", () => {
  before(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  it("accepts a report of exactly 16 KiB", async () => {
    const payload = reportOfExactSize(MAX_BODY_BYTES);
    assert.equal(new TextEncoder().encode(payload).byteLength, MAX_BODY_BYTES);

    const response = await POST(post(payload, { ip: "203.0.113.21" }));
    assert.equal(response.status, 204);
  });

  it("rejects 16 KiB + 1 byte with 413 PAYLOAD_TOO_LARGE", async () => {
    const payload = reportOfExactSize(MAX_BODY_BYTES + 1);

    const response = await POST(post(payload, { ip: "203.0.113.22" }));
    assert.equal(response.status, 413);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "PAYLOAD_TOO_LARGE");
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    const { request } = postStream(MAX_BODY_BYTES * 4, {
      ip: "203.0.113.23",
      contentLength: String(MAX_BODY_BYTES * 4),
    });

    const response = await POST(request);
    assert.equal(response.status, 413);
    assert.equal(
      request.body?.locked,
      false,
      "the body must not be read when Content-Length already proves it is too large",
    );
  });

  it("rejects a chunked body without Content-Length that exceeds the limit", async () => {
    const { request } = postStream(MAX_BODY_BYTES * 4, { ip: "203.0.113.24" });
    assert.equal(request.headers.get("content-length"), null);

    const response = await POST(request);
    assert.equal(response.status, 413);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "PAYLOAD_TOO_LARGE");
    assert.equal(
      request.body?.locked,
      true,
      "the handler must have started reading and cancelled once the cap was crossed",
    );
  });

  it("rejects a lying Content-Length (small header, oversized body)", async () => {
    const { request } = postStream(MAX_BODY_BYTES * 4, {
      ip: "203.0.113.25",
      contentLength: "10",
    });
    assert.equal(request.headers.get("content-length"), "10");

    const response = await POST(request);
    assert.equal(response.status, 413);
    assert.equal(
      request.body?.locked,
      true,
      "a lying Content-Length must not bypass the byte counter",
    );
  });

  it("rejects a malformed Content-Length with 400", async () => {
    const response = await POST(post("{}", { ip: "203.0.113.26", contentLength: "12abc" }));
    assert.equal(response.status, 400);
  });
});

describe("POST /api/csp-report — M2-04 rate limiting", () => {
  before(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  it("applies the quota before reading the body", async () => {
    const ip = "203.0.113.31";

    for (let i = 0; i < RATE_LIMIT; i++) {
      const response = await POST(post("{}", { ip }));
      assert.equal(response.status, 204, `request ${i + 1} should be accepted`);
    }

    const { request } = postStream(64, { ip });
    const response = await POST(request);

    assert.equal(response.status, 429);
    assert.equal(
      request.body?.locked,
      false,
      "an over-quota request must be rejected without consuming its body",
    );

    const body = (await response.json()) as { code?: string; retryAfterMs?: number };
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(typeof body.retryAfterMs, "number");
    assert.ok(response.headers.get("retry-after"));
    assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
  });

  it("keeps quotas independent per client IP", async () => {
    // 203.0.113.31 is still exhausted by the previous test.
    const exhausted = await POST(post("{}", { ip: "203.0.113.31" }));
    assert.equal(exhausted.status, 429);

    const other = await POST(post("{}", { ip: "203.0.113.32" }));
    assert.equal(other.status, 204, "a different IP must keep its own quota");
  });

  it("fails closed with 500 when the client IP cannot be verified in production", async () => {
    const envObj = process.env as Record<string, string | undefined>;
    const originalNodeEnv = envObj.NODE_ENV;
    const originalProxy = envObj.TRUSTED_PROXY;
    try {
      envObj.NODE_ENV = "production";
      delete envObj.TRUSTED_PROXY;

      const response = await POST(post("{}", { ip: "203.0.113.33" }));
      assert.equal(response.status, 500);
      const body = (await response.json()) as { code?: string };
      assert.equal(body.code, "IP_VERIFICATION_FAILED");
    } finally {
      envObj.NODE_ENV = originalNodeEnv;
      envObj.TRUSTED_PROXY = originalProxy;
    }
  });
});
