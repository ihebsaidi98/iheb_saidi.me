import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";

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
 * POST whose body is delivered as a stream, so the test controls chunking and
 * can observe from the outside whether the handler consumed the body.
 */
function postChunked(
  bytes: Uint8Array,
  options: { ip?: string; contentLength?: string; chunkSize?: number } = {},
): { request: NextRequest } {
  let offset = 0;
  const chunkSize = options.chunkSize ?? bytes.byteLength;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
      offset += chunkSize;
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

function postStream(
  sizeBytes: number,
  options: { ip?: string; contentLength?: string } = {},
): { request: NextRequest } {
  return postChunked(new TextEncoder().encode("a".repeat(sizeBytes)), options);
}

/**
 * Bytes the handler left unread. `0` means the body was consumed (read to the
 * end or cancelled); a positive count means the handler returned without ever
 * taking a reader. This stays meaningful after the handler releases its lock,
 * unlike `request.body.locked`.
 */
async function bytesRemaining(request: NextRequest): Promise<number> {
  const body = request.body;
  if (!body) return 0;
  if (body.locked) return -1;

  const reader = body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
    }
  } finally {
    reader.releaseLock();
  }
  return total;
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
    assert.ok(
      (await bytesRemaining(request)) > 0,
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
      await bytesRemaining(request),
      0,
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
      await bytesRemaining(request),
      0,
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
    assert.ok(
      (await bytesRemaining(request)) > 0,
      "an over-quota request must be rejected without consuming its body",
    );

    const body = (await response.json()) as { code?: string; retryAfterMs?: number };
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(typeof body.retryAfterMs, "number");
    assert.ok(response.headers.get("retry-after"));
    assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
  });

  it("keeps quotas independent per client IP", async () => {
    const saturatedIp = "203.0.113.34";
    const freshIp = "203.0.113.35";

    for (let i = 0; i < RATE_LIMIT; i++) {
      const response = await POST(post("{}", { ip: saturatedIp }));
      assert.equal(response.status, 204, `request ${i + 1} should be accepted`);
    }
    assert.equal((await POST(post("{}", { ip: saturatedIp }))).status, 429);

    const other = await POST(post("{}", { ip: freshIp }));
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

describe("POST /api/csp-report — reader lifecycle and control order", () => {
  before(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  it("releases the reader once the report has been read", async () => {
    const request = post(JSON.stringify({ "csp-report": { "blocked-uri": "x" } }), {
      ip: "203.0.113.41",
    });

    const response = await POST(request);
    assert.equal(response.status, 204);
    assert.equal(
      request.body?.locked,
      false,
      "the handler must not leave the request body locked for the rest of the request",
    );
  });

  it("returns 204 and releases the reader when the body stream fails", async () => {
    const errorMock = mock.method(console, "error", () => undefined);
    try {
      let pulls = 0;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          if (pulls === 1) controller.enqueue(encoder.encode('{"csp-report":{'));
          else controller.error(new Error("connection lost"));
        },
      });
      const request = new NextRequest("http://localhost:3000/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.42" },
        body: stream,
        duplex: "half",
      } as unknown as ConstructorParameters<typeof NextRequest>[1]);

      const response = await POST(request);

      assert.equal(response.status, 204, "a broken body stream must not surface as a 5xx");
      assert.equal(
        request.body?.locked,
        false,
        "the reader must be released on the read-error path too",
      );
      assert.equal(errorMock.mock.callCount(), 1, "the failure must still be logged once");
    } finally {
      errorMock.mock.restore();
    }
  });

  it("decodes a UTF-8 character split across several chunks", async () => {
    const overhead = Buffer.byteLength(JSON.stringify({ "csp-report": { "blocked-uri": "" } }));
    const inner = MAX_BODY_BYTES - overhead;
    const repeat = Math.floor(inner / 2);
    const blockedUri = "é".repeat(repeat) + "a".repeat(inner - repeat * 2);
    const bytes = new TextEncoder().encode(JSON.stringify({ "csp-report": { "blocked-uri": blockedUri } }));
    assert.equal(bytes.byteLength, MAX_BODY_BYTES, "the payload must sit exactly on the cap");

    const { request } = postChunked(bytes, { ip: "203.0.113.43", chunkSize: 7 });
    const warnMock = mock.method(console, "warn", () => undefined);
    try {
      const response = await POST(request);

      assert.equal(response.status, 204);
      assert.ok(
        warnMock.mock.calls.some((call) => {
          const message = String(call.arguments[0]);
          return (
            message.includes(`blocked="${blockedUri.slice(0, 50)}`) &&
            !message.includes("\uFFFD")
          );
        }),
        "a multi-byte character split between chunks must be reassembled before logging",
      );
    } finally {
      warnMock.mock.restore();
    }
  });

  it("accepts a body of exactly 16 KiB announced by Content-Length", async () => {
    const payload = reportOfExactSize(MAX_BODY_BYTES);

    const response = await POST(
      post(payload, { ip: "203.0.113.47", contentLength: String(MAX_BODY_BYTES) }),
    );
    assert.equal(response.status, 204, "the pre-flight cap is inclusive");
  });

  it("applies the quota, then the Content-Length cap, then the media type", async () => {
    const saturatedIp = "203.0.113.48";
    for (let i = 0; i < RATE_LIMIT; i++) {
      assert.equal((await POST(post("{}", { ip: saturatedIp }))).status, 204);
    }

    const overQuota = await POST(
      post("hi", { ip: saturatedIp, contentType: "text/plain", contentLength: "999999" }),
    );
    assert.equal(overQuota.status, 429, "the quota is decided before the body is looked at");

    const tooLarge = await POST(
      post("hi", { ip: "203.0.113.49", contentType: "text/plain", contentLength: "999999" }),
    );
    assert.equal(tooLarge.status, 413, "an announced oversized body is rejected before the media type");

    const unsupported = await POST(post("hi", { ip: "203.0.113.50", contentType: "text/plain" }));
    assert.equal(unsupported.status, 415);
  });
});

describe("POST /api/csp-report — M2-03 log hardening", () => {
  const MAX_FIELD_CHARS = 200;
  const MAX_SNIPPET_CHARS = 500;
  const SNIPPET_PREFIX = "[csp-report] Received non-JSON violation report: ";

  before(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  async function warnLinesFor(request: NextRequest): Promise<string[]> {
    const warnMock = mock.method(console, "warn", () => undefined);
    try {
      await POST(request);
      return warnMock.mock.calls.map((call) => String(call.arguments[0]));
    } finally {
      warnMock.mock.restore();
    }
  }

  function report(fields: Record<string, unknown>): string {
    return JSON.stringify({ "csp-report": fields });
  }

  it("truncates a long value to 200 characters and reports the exact number dropped", () => {
    for (const size of [300, 5000]) {
      const original = "A".repeat(size);
      const sanitized = sanitizeCspReportData(original);

      assert.equal(sanitized.length, MAX_FIELD_CHARS, `size ${size}`);

      const marker = /…\[\+(\d+)\]$/.exec(sanitized);
      assert.ok(marker, `missing marker in ${sanitized.slice(-12)}`);

      const kept = sanitized.length - marker[0].length;
      assert.equal(kept + Number(marker[1]), size, "the marker must account for every dropped character");
    }
  });

  it("bounds the whole log line when the three fields are long", async () => {
    const big = "A".repeat(5000);
    const lines = await warnLinesFor(
      post(
        report({ "blocked-uri": big, "violated-directive": big, "document-uri": big }),
        { ip: "203.0.113.61" },
      ),
    );

    assert.equal(lines.length, 1);
    const [line] = lines;
    assert.ok(line.length <= 3 * MAX_FIELD_CHARS + 100, `log line too long: ${line.length}`);
    assert.ok(line.includes('blocked="'));
    assert.ok(line.includes('directive="'));
    assert.ok(line.includes('document="'));
  });

  it("prevents a reported value from forging the log structure", async () => {
    const lines = await warnLinesFor(
      post(
        report({
          "blocked-uri": 'x", blocked="fake',
          "violated-directive": "script-src",
          "document-uri": "https://example.com/",
        }),
        { ip: "203.0.113.62" },
      ),
    );

    const [line] = lines;
    assert.equal(
      line.split('blocked="').length - 1,
      1,
      `the value created a second field: ${line}`,
    );
    assert.ok(!line.includes('"fake"'));
  });

  it("strips control and bidirectional characters from logged values", async () => {
    const hostile = "a\u001b[31m\u0000b\u007fc\u000bd\u000ce\u2028f\u202eg";
    const lines = await warnLinesFor(
      post(report({ "blocked-uri": hostile, "violated-directive": "script-src" }), {
        ip: "203.0.113.63",
      }),
    );

    const [line] = lines;
    assert.doesNotMatch(line, /[\u0000-\u001F\u007F\u0085\u2028\u2029\u202A-\u202E\u2066-\u2069]/);
    assert.ok(line.includes("[31m"), "the readable part must survive for diagnosis");
    assert.match(line, /b\s*c\s*d\s*e\s*f\s*g/, "the visible characters must remain, in order");
  });

  it("redacts extra sensitive parameters, bare JWTs and URL-encoded values", () => {
    const cases: Array<[string, string]> = [
      ["https://example.com/?password=hunter2&user=bob", "password=[REDACTED_SECRET]"],
      ["https://example.com/?passwd=p1", "passwd=[REDACTED_SECRET]"],
      ["https://example.com/?pwd=p2", "pwd=[REDACTED_SECRET]"],
      ["https://s3.example.com/x?X-Amz-Signature=deadbeef", "Signature=[REDACTED_SECRET]"],
      ["https://example.com/?sig=abcdef123456", "sig=[REDACTED_SECRET]"],
      ["https://example.com/?session=zzz999", "session=[REDACTED_SECRET]"],
      ["https://example.com/?auth=abc.def", "auth=[REDACTED_SECRET]"],
      ["https://example.com/?key=abc%2Fdef%3D", "key=[REDACTED_SECRET]"],
    ];

    for (const [input, expected] of cases) {
      const sanitized = sanitizeCspReportData(input);
      assert.ok(sanitized.includes(expected), `${input} -> ${sanitized}`);
    }

    const encoded = sanitizeCspReportData("https://example.com/?key=abc%2Fdef%3D");
    assert.ok(!encoded.includes("%2F"), `URL-encoded secret leaked: ${encoded}`);

    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const sanitizedJwt = sanitizeCspReportData(`https://example.com/?t=${jwt}`);
    assert.ok(!sanitizedJwt.includes(jwt), "a bare JWT must be redacted");
    assert.ok(sanitizedJwt.includes("[REDACTED_JWT]"));
  });

  it("keeps the original parameter name in the redacted value", () => {
    assert.equal(sanitizeCspReportData("secret=xyz"), "secret=[REDACTED_SECRET]");
    assert.equal(
      sanitizeCspReportData("https://example.com/?token=abc"),
      "https://example.com/?token=[REDACTED_SECRET]",
    );
    assert.ok(!sanitizeCspReportData("https://example.com/?api_key=abc").includes("api_token"));
  });

  it("limits the non-JSON snippet to 500 characters", async () => {
    const junk = "x".repeat(16 * 1024);
    const lines = await warnLinesFor(
      post(junk, {
        ip: "203.0.113.64",
        contentType: "application/csp-report",
        contentLength: String(junk.length),
      }),
    );

    assert.equal(lines.length, 1);
    const [line] = lines;
    assert.ok(line.startsWith(SNIPPET_PREFIX), `unexpected prefix: ${line.slice(0, 60)}`);
    assert.ok(
      line.length <= SNIPPET_PREFIX.length + MAX_SNIPPET_CHARS,
      `snippet too long: ${line.length}`,
    );
  });

  it("never logs the script-sample field", async () => {
    const lines = await warnLinesFor(
      post(
        report({
          "blocked-uri": "inline",
          "violated-directive": "script-src",
          "script-sample": "SECRET_SCRIPT_SAMPLE_1234",
        }),
        { ip: "203.0.113.65" },
      ),
    );

    assert.ok(!lines.join(" ").includes("SECRET_SCRIPT_SAMPLE_1234"));
  });

  it("keeps credentials out of the logged line without losing ordinary parameters", async () => {
    const credential = "dXNlcjpwYXNz";
    const lines = await warnLinesFor(
      post(
        report({
          "blocked-uri": `https://cdn.example/lib.js (Authorization: Basic ${credential})`,
          "document-uri": "https://iheb-saidi.dev/?password=hunter2&monkey=banana",
        }),
        { ip: "203.0.113.66" },
      ),
    );

    const line = lines.join(" ");
    assert.ok(!line.includes(credential), `credential leaked: ${line}`);
    assert.ok(!line.includes("hunter2"), `password leaked: ${line}`);
    assert.ok(line.includes("monkey=banana"), `ordinary parameter lost: ${line}`);
  });
});

describe("sanitizeCspReportData — credentials and false positives", () => {
  it("redacts Authorization Basic credentials and never keeps their value", () => {
    const withPadding = "dXNlcjpwYXNzMTIzNDU2Nzg5MA==";
    const inputs = [
      "Authorization: Basic dXNlcjpwYXNz",
      "authorization:   basic   dXNlcjpwYXNz",
      `Authorization: Basic ${withPadding}`,
      `https://example.com/redirect (Authorization: Basic ${withPadding})`,
    ];

    for (const input of inputs) {
      const sanitized = sanitizeCspReportData(input);
      assert.ok(
        !sanitized.includes("dXNlcjpwYXNz"),
        `credential survived in: ${sanitized}`,
      );
      assert.ok(
        sanitized.includes("Authorization: Basic [REDACTED]"),
        `header not normalised in: ${sanitized}`,
      );
    }
  });

  it("leaves ordinary parameter names alone", () => {
    for (const input of [
      "monkey=banana",
      "hockey=stick",
      "https://example.com/?monkey=banana&user=bob",
      "https://example.com/?oauth=public_client_id",
    ]) {
      assert.equal(sanitizeCspReportData(input), input);
    }
  });

  it("still redacts every documented sensitive key", () => {
    const cases: Array<[string, string]> = [
      ["https://example.com/?api_key=abc123def", "api_key=[REDACTED_SECRET]"],
      ["https://example.com/?client_secret=shh", "client_secret=[REDACTED_SECRET]"],
      ["https://s3.example.com/x?X-Amz-Signature=deadbeef", "X-Amz-Signature=[REDACTED_SECRET]"],
      ["https://example.com/?password=hunter2", "password=[REDACTED_SECRET]"],
      ["https://example.com/?sig=abcdef123456", "sig=[REDACTED_SECRET]"],
      ["&token=abc", "&token=[REDACTED_SECRET]"],
      ["session=zzz999", "session=[REDACTED_SECRET]"],
    ];

    for (const [input, expected] of cases) {
      const sanitized = sanitizeCspReportData(input);
      assert.ok(sanitized.includes(expected), `${input} -> ${sanitized}`);
    }
  });
});
