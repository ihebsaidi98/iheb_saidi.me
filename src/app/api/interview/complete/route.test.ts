import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";
import { aiServiceClient, AIServiceClientError } from "@/lib/ai-service-client";

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

  it("returns 429 RATE_LIMITED when rate limit threshold is exceeded", async () => {
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
    // Default limit is 15 requests per window
    for (let i = 0; i < 15; i++) {
      const res = await POST(createRequest(validPayload, { ip: fixedIp }));
      assert.equal(res.status, 200);
    }

    const blockedRes = await POST(createRequest(validPayload, { ip: fixedIp }));
    assert.equal(blockedRes.status, 429);

    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.equal(typeof data.retryAfterMs, "number");
    assert.ok(data.retryAfterMs > 0);

    assert.equal(blockedRes.headers.get("X-RateLimit-Limit"), "15");
    assert.equal(blockedRes.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blockedRes.headers.get("X-RateLimit-Reset"));
    assert.ok(Number(blockedRes.headers.get("X-RateLimit-Reset")) > 0);
    assert.ok(blockedRes.headers.get("Retry-After"));
    assert.ok(Number(blockedRes.headers.get("Retry-After")) > 0);
  });
});
