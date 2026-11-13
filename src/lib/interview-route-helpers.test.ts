/**
 * src/lib/interview-route-helpers.test.ts
 *
 * Unit tests for shared interview route helpers:
 *   - checkContentLength
 *   - parseJsonBody
 *   - validationErrorResponse
 *   - handleInterviewApiError
 *   - methodNotAllowedResponse
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { AIServiceClientError } from "@/lib/ai-service-client";
import {
  checkContentLength,
  parseJsonBody,
  validationErrorResponse,
  handleInterviewApiError,
  methodNotAllowedResponse,
} from "./interview-route-helpers";

describe("interview-route-helpers", () => {
  describe("checkContentLength", () => {
    it("returns 413 when content-length exceeds max limit", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "20000" },
      });
      const res = checkContentLength(req, 16384);
      assert.ok(res);
      assert.equal(res.status, 413);
      const data = await res.json();
      assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    });

    it("returns null when content-length is within limit", () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "500" },
      });
      const res = checkContentLength(req, 16384);
      assert.equal(res, null);
    });

    it("returns null when content-length header is absent", () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
      });
      const res = checkContentLength(req, 16384);
      assert.equal(res, null);
    });

    it("returns 400 BAD_REQUEST when content-length contains partial alphanumeric like 100abc", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "100abc" },
      });
      const res = checkContentLength(req, 16384);
      assert.ok(res);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "BAD_REQUEST");
      assert.equal(data.error, "Invalid Content-Length header.");
    });

    it("returns 400 BAD_REQUEST when content-length is negative", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "-1" },
      });
      const res = checkContentLength(req, 16384);
      assert.ok(res);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "BAD_REQUEST");
      assert.equal(data.error, "Invalid Content-Length header.");
    });

    it("returns 400 BAD_REQUEST when content-length contains decimal values", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "12.34" },
      });
      const res = checkContentLength(req, 16384);
      assert.ok(res);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "BAD_REQUEST");
      assert.equal(data.error, "Invalid Content-Length header.");
    });

    it("returns 400 BAD_REQUEST when content-length is non-numeric, empty, or special string", async () => {
      for (const invalid of ["abc", "", "   ", "NaN", "Infinity", "+500"]) {
        const req = new NextRequest("http://localhost/api/interview/start", {
          method: "POST",
          headers: { "content-length": invalid },
        });
        const res = checkContentLength(req, 16384);
        assert.ok(res, `Should reject "${invalid}" with 400`);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.code, "BAD_REQUEST");
      }
    });

    it("accepts valid content-length with surrounding whitespace", () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "content-length": "  500  " },
      });
      const res = checkContentLength(req, 16384);
      assert.equal(res, null);
    });
  });

  describe("parseJsonBody", () => {
    it("parses valid JSON successfully", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        body: JSON.stringify({ track: "full_stack" }),
      });
      const res = await parseJsonBody(req, 16384);
      assert.equal(res.success, true);
      if (res.success) {
        assert.deepEqual(res.data, { track: "full_stack" });
      }
    });

    it("parses valid JSON containing Unicode characters within limits", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        body: JSON.stringify({ name: "Iheb Saïdi", message: "مرحبا بالعالم 🚀" }),
      });
      const res = await parseJsonBody(req, 16384);
      assert.equal(res.success, true);
      if (res.success) {
        assert.deepEqual(res.data, { name: "Iheb Saïdi", message: "مرحبا بالعالم 🚀" });
      }
    });

    it("returns 413 when raw text length exceeds max limit", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        body: "a".repeat(100),
      });
      const res = await parseJsonBody(req, 50, { "X-Test": "1" });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.response.status, 413);
        assert.equal(res.response.headers.get("X-Test"), "1");
        const data = await res.response.json();
        assert.equal(data.code, "PAYLOAD_TOO_LARGE");
      }
    });

    it("returns 413 when Unicode characters cause UTF-8 byte length to exceed limit even if char count is small", async () => {
      // 40 rocket emojis = 80 UTF-16 code units (text.length = 80), but 40 * 4 = 160 UTF-8 bytes!
      // With max limit of 100 bytes, text.length (80) would pass, but UTF-8 byteLength (160) must trigger 413.
      const payload = "🚀".repeat(40);
      assert.ok(payload.length < 100, "Char length should be below 100");
      assert.ok(Buffer.byteLength(payload, "utf8") > 100, "Byte length should exceed 100");

      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        body: payload,
      });
      const res = await parseJsonBody(req, 100, { "X-RateLimit-Remaining": "14" });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.response.status, 413);
        assert.equal(res.response.headers.get("X-RateLimit-Remaining"), "14");
        const data = await res.response.json();
        assert.equal(data.code, "PAYLOAD_TOO_LARGE");
      }
    });

    it("returns 400 when JSON syntax is invalid", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
        body: "{not-json}",
      });
      const res = await parseJsonBody(req, 16384, { "X-Test": "1" });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.response.status, 400);
        assert.equal(res.response.headers.get("X-Test"), "1");
        const data = await res.response.json();
        assert.equal(data.code, "BAD_REQUEST");
      }
    });

    it("handles empty body gracefully by returning empty object", async () => {
      const req = new NextRequest("http://localhost/api/interview/start", {
        method: "POST",
      });
      const res = await parseJsonBody(req, 16384);
      assert.equal(res.success, true);
      if (res.success) {
        assert.deepEqual(res.data, {});
      }
    });
  });

  describe("validationErrorResponse", () => {
    it("returns standardized 422 validation response", async () => {
      const res = validationErrorResponse("Field missing", 422, { "X-Test": "1" });
      assert.equal(res.status, 422);
      assert.equal(res.headers.get("X-Test"), "1");
      const data = await res.json();
      assert.equal(data.error, "Field missing");
      assert.equal(data.code, "VALIDATION_ERROR");
    });
  });

  describe("handleInterviewApiError", () => {
    it("handles TOKEN_MISMATCH as 403 with clean message", async () => {
      const err = new AIServiceClientError("Session token mismatch", {
        status: 403,
        code: "TOKEN_MISMATCH",
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
        headers: { "X-Test": "1" },
      });
      assert.equal(res.status, 403);
      assert.equal(res.headers.get("X-Test"), "1");
      const data = await res.json();
      assert.equal(data.code, "TOKEN_MISMATCH");
      assert.equal(data.error, "Session token mismatch");
    });

    it("handles 401 as 500 AUTH_ERROR without credential leak", async () => {
      const err = new AIServiceClientError("Unauthorized internal token", {
        status: 401,
        code: "UNAUTHORIZED",
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
      });
      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.code, "AUTH_ERROR");
      assert.match(data.error, /authentication failed/i);
    });

    it("handles INVALID_RESPONSE as 502 UPSTREAM_ERROR", async () => {
      const err = new AIServiceClientError("Bad schema", {
        status: 502,
        code: "INVALID_RESPONSE",
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
      });
      assert.equal(res.status, 502);
      const data = await res.json();
      assert.equal(data.code, "UPSTREAM_ERROR");
    });

    it("returns 504 UPSTREAM_TIMEOUT for an explicit timeout without internal details (API-LOT2-02)", async () => {
      const err = new AIServiceClientError("[AIServiceClient] Interview complete request timed out", {
        status: 504,
        code: "TIMEOUT",
        isUnavailable: true,
        requestId: "req-internal-42",
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
        headers: { "X-Test": "1" },
      });
      assert.equal(res.status, 504);
      assert.equal(res.headers.get("X-Test"), "1");
      const data = (await res.json()) as { error: string; code: string };
      assert.equal(data.code, "UPSTREAM_TIMEOUT");
      assert.match(data.error, /took too long/i);
      // No upstream message, request id or stack trace leaks through.
      assert.ok(!data.error.includes("req-internal-42"));
      assert.ok(!data.error.includes("AIServiceClient"));
      assert.ok(!data.error.includes("timed out".toLowerCase() && "request"));
    });

    it("maps an upstream 504 without TIMEOUT code to 504 as well (API-LOT2-02)", async () => {
      const err = new AIServiceClientError("Upstream gateway timeout", {
        status: 504,
        code: "HTTP_ERROR",
        isUnavailable: true,
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
      });
      assert.equal(res.status, 504);
      const data = (await res.json()) as { code: string };
      assert.equal(data.code, "UPSTREAM_TIMEOUT");
    });

    it("handles 503 SERVICE_UNAVAILABLE with clean message", async () => {
      const err = new AIServiceClientError("Down", {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        isUnavailable: true,
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
      });
      assert.equal(res.status, 503);
      const data = await res.json();
      assert.equal(data.code, "SERVICE_UNAVAILABLE");
      assert.equal(data.error, "Down");
    });

    it("handles 4xx client errors by forwarding status and code", async () => {
      const err = new AIServiceClientError("Not found", {
        status: 404,
        code: "SESSION_NOT_FOUND",
      });
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Fallback",
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.code, "SESSION_NOT_FOUND");
      assert.equal(data.error, "Not found");
    });

    it("handles unexpected errors with fallback 502 INTERVIEW_ERROR", async () => {
      const err = new Error("Network crash");
      const res = handleInterviewApiError(err, {
        routeLabel: "interview/test",
        fallbackMessage: "Custom fallback error.",
      });
      assert.equal(res.status, 502);
      const data = await res.json();
      assert.equal(data.code, "INTERVIEW_ERROR");
      assert.equal(data.error, "Custom fallback error.");
    });
  });

  describe("methodNotAllowedResponse", () => {
    it("returns 405 with Allow header", async () => {
      const res = methodNotAllowedResponse("Method Not Allowed. Use POST.");
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("Allow"), "POST");
      const data = await res.json();
      assert.equal(data.code, "METHOD_NOT_ALLOWED");
      assert.equal(data.error, "Method Not Allowed. Use POST.");
    });
  });
});

// ============================================================
// AUD-01 — the body cap must be enforced WHILE streaming.
//
// These tests do not inspect wall-clock time or heap usage: they count the
// bytes the handler actually pulls out of the stream. A handler that calls
// `request.text()` first pulls every byte and only then compares sizes, so
// the bound is observably not enforced at the boundary.
// ============================================================

type StreamProbe = {
  /** Bytes actually handed to the consumer by the underlying source. */
  pulledBytes: number;
  chunks: number;
  /** True when the consumer cancelled before the source was exhausted. */
  cancelled: boolean;
};

/**
 * POST whose body is a deterministic chunked stream, with no Content-Length
 * unless one is explicitly supplied. `probe` records how far the handler read.
 */
function chunkedPost(
  bytes: Uint8Array,
  options: { chunkSize?: number; contentLength?: string } = {},
): { request: NextRequest; probe: StreamProbe } {
  const chunkSize = options.chunkSize ?? 1024;
  const probe: StreamProbe = { pulledBytes: 0, chunks: 0, cancelled: false };
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.byteLength);
      probe.pulledBytes += end - offset;
      probe.chunks += 1;
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
    cancel() {
      probe.cancelled = true;
    },
  });

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.contentLength !== undefined) {
    headers["content-length"] = options.contentLength;
  }

  const request = new NextRequest("http://localhost/api/interview/start", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);

  return { request, probe };
}

/** Build valid JSON whose UTF-8 byte length is exactly `targetBytes`. */
function jsonOfExactSize(targetBytes: number): string {
  const template = (padding: number) =>
    JSON.stringify({ answer: "a".repeat(padding) });
  const overhead = template(0).length;
  assert.ok(targetBytes > overhead, "target size must exceed the JSON overhead");
  return template(targetBytes - overhead);
}

describe("parseJsonBody — AUD-01 bounded streaming", () => {
  const MAX = 4096;
  const CHUNK = 256;

  it("stops reading a chunked body (no Content-Length) as soon as the cap is crossed", async () => {
    // 64 KiB streamed in 256-byte chunks: 16× the cap.
    const bytes = new TextEncoder().encode(jsonOfExactSize(MAX * 16));
    const { request, probe } = chunkedPost(bytes, { chunkSize: CHUNK });
    assert.equal(request.headers.get("content-length"), null);

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.response.status, 413);
      const data = (await res.response.json()) as { code?: string };
      assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    }
    assert.ok(
      probe.pulledBytes < bytes.byteLength,
      `handler consumed ${probe.pulledBytes}/${bytes.byteLength} bytes; the cap must stop the read`,
    );
    assert.ok(
      probe.pulledBytes <= MAX + 2 * CHUNK,
      `consumed ${probe.pulledBytes} bytes, expected at most cap + 2 chunks (${MAX + 2 * CHUNK})`,
    );
    assert.equal(probe.cancelled, true, "the body stream must be cancelled, not drained");
  });

  it("ignores a lying Content-Length and still bounds the real byte count", async () => {
    const bytes = new TextEncoder().encode(jsonOfExactSize(MAX * 16));
    const { request, probe } = chunkedPost(bytes, {
      chunkSize: CHUNK,
      contentLength: "10",
    });

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, false);
    if (!res.success) assert.equal(res.response.status, 413);
    assert.ok(
      probe.pulledBytes <= MAX + 2 * CHUNK,
      `a small announced Content-Length must not allow a full drain (pulled ${probe.pulledBytes})`,
    );
    assert.equal(probe.cancelled, true);
  });

  it("accepts a body of exactly the maximum size", async () => {
    const payload = jsonOfExactSize(MAX);
    const bytes = new TextEncoder().encode(payload);
    assert.equal(bytes.byteLength, MAX);

    const { request } = chunkedPost(bytes, { chunkSize: CHUNK });
    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, true);
    if (res.success) {
      assert.deepEqual(res.data, JSON.parse(payload));
    }
  });

  it("rejects a body one byte over the maximum", async () => {
    const bytes = new TextEncoder().encode(jsonOfExactSize(MAX + 1));
    const { request } = chunkedPost(bytes, { chunkSize: CHUNK });

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.response.status, 413);
      const data = (await res.response.json()) as { code?: string };
      assert.equal(data.code, "PAYLOAD_TOO_LARGE");
    }
  });

  it("reassembles UTF-8 characters split across chunk boundaries", async () => {
    // 2-byte characters forced across 3-byte chunk boundaries.
    const answer = "é".repeat(40);
    const payload = JSON.stringify({ answer });
    const bytes = new TextEncoder().encode(payload);

    // 3-byte chunks guarantee that some characters are split mid-sequence.
    const { request } = chunkedPost(bytes, { chunkSize: 3 });
    const res = await parseJsonBody(request, bytes.byteLength);

    assert.equal(res.success, true);
    if (res.success) {
      const data = res.data as { answer?: string };
      assert.equal(data.answer, answer);
      assert.ok(!payload.includes("\uFFFD"), "no replacement characters may be produced");
    }
  });

  it("releases the reader lock after a successful parse", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ track: "backend" }));
    const { request } = chunkedPost(bytes);

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, true);
    assert.equal(request.body?.locked, false, "the body must not stay locked after a parse");
  });

  it("releases the reader lock and keeps the 413 when the cap is exceeded", async () => {
    const bytes = new TextEncoder().encode(jsonOfExactSize(MAX * 8));
    const { request } = chunkedPost(bytes, { chunkSize: CHUNK });

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, false);
    if (!res.success) assert.equal(res.response.status, 413);
    assert.equal(request.body?.locked, false, "the overflowing read must still release the lock");
  });

  it("keeps the 400 contract when the body stream errors", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new TextEncoder().encode('{"track":'));
        else controller.error(new Error("connection lost"));
      },
    });
    const request = new NextRequest("http://localhost/api/interview/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);

    const res = await parseJsonBody(request, MAX);

    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.response.status, 400);
      const data = (await res.response.json()) as { code?: string };
      assert.equal(data.code, "BAD_REQUEST");
    }
    assert.equal(request.body?.locked, false, "the error path must release the lock too");
  });
});
