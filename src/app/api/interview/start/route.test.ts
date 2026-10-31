import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";
import { aiServiceClient, AIServiceClientError } from "@/lib/ai-service-client";

describe("POST /api/interview/start — Secure Proxy Route", () => {
  const originalIsConfigured = aiServiceClient.isConfigured;
  const originalStartInterview = aiServiceClient.startInterview;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TRUSTED_PROXY = "true";
    process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";
    delete process.env.AI_SERVICE_ENABLED;
  });

  afterEach(() => {
    aiServiceClient.isConfigured = originalIsConfigured;
    aiServiceClient.startInterview = originalStartInterview;
    process.env = { ...originalEnv };
  });

  function createRequest(
    body: unknown,
    options: {
      ip?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const ip = options.ip ?? "192.168.1.100";
    return new NextRequest("http://localhost:3000/api/interview/start", {
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

  it("initializes an interview session successfully and returns 200", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async (opts = {}) => {
      assert.equal(opts.track, "full_stack");
      assert.equal(opts.difficulty, "senior");
      return {
        session_id: "session-test-123",
        session_token: "token-test-123",
        track: "full_stack",
        total_questions: 10,
        initial_question: {
          question_id: "fs-mcq-01",
          question_number: 1,
          total_questions: 10,
          question_text: "Which HTTP status code indicates resource creation?",
          question_type: "mcq",
          track: "full_stack",
          topic: "HTTP",
          options: ["200", "201", "204", "301"],
          expected_talking_points: ["RFC 7231"],
        },
      };
    };

    const req = createRequest({ track: "full_stack", difficulty: "senior" }, { ip: "192.168.1.101" });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.session_id, "session-test-123");
    assert.equal(data.session_token, "token-test-123");
    assert.equal(data.initial_question.question_id, "fs-mcq-01");
    assert.ok(res.headers.get("X-RateLimit-Limit"));
  });

  it("handles empty body by applying default track and difficulty", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async (opts = {}) => {
      assert.equal(opts.track, undefined);
      assert.equal(opts.difficulty, undefined);
      return {
        session_id: "session-default-456",
        session_token: "token-default-456",
        track: "full_stack",
        total_questions: 10,
        initial_question: {
          question_id: "fs-mcq-01",
          question_number: 1,
          total_questions: 10,
          question_text: "Default question text",
          question_type: "mcq",
          track: "full_stack",
          topic: "HTTP",
          options: ["A", "B", "C", "D"],
        },
      };
    };

    const req = createRequest({}, { ip: "192.168.1.102" });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.session_id, "session-default-456");
  });

  it("returns 405 Method Not Allowed on GET with Allow header", async () => {
    const res = await GET();
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
    const data = await res.json();
    assert.equal(data.code, "METHOD_NOT_ALLOWED");
  });

  it("returns 413 Payload Too Large when Content-Length exceeds maximum", async () => {
    const req = createRequest(
      { track: "full_stack" },
      {
        ip: "192.168.1.103",
        headers: { "content-length": "20000" }, // exceeds MAX_START_BODY_SIZE (16384)
      },
    );
    const res = await POST(req);
    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.code, "PAYLOAD_TOO_LARGE");
  });

  it("returns 400 Bad Request on malformed JSON payload", async () => {
    const req = createRequest("this is not valid {json}", { ip: "192.168.1.104" });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "BAD_REQUEST");
  });

  it("returns 422 Validation Error on invalid track name", async () => {
    const req = createRequest({ track: "cybersecurity" }, { ip: "192.168.1.105" });
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.match(data.error, /track must be one of/);
  });

  it("returns 422 Validation Error on invalid difficulty level", async () => {
    const req = createRequest({ difficulty: "expert" }, { ip: "192.168.1.106" });
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.match(data.error, /difficulty must be one of/);
  });

  it("returns 422 Validation Error when focus_areas exceeds 10 items", async () => {
    const focus_areas = Array.from({ length: 11 }, (_, i) => `topic-${i}`);
    const req = createRequest({ focus_areas }, { ip: "192.168.1.107" });
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("returns 503 SERVICE_UNAVAILABLE when AI service is not configured", async () => {
    aiServiceClient.isConfigured = () => false;
    const req = createRequest({ track: "full_stack" }, { ip: "192.168.1.108" });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "SERVICE_UNAVAILABLE");
  });

  it("returns 500 AUTH_ERROR and does not leak credentials when upstream returns 401", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async () => {
      throw new AIServiceClientError("Invalid internal token", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    };

    const req = createRequest({ track: "full_stack" }, { ip: "192.168.1.109" });
    const res = await POST(req);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.code, "AUTH_ERROR");
    // Ensure no token or sensitive details leaked
    assert.equal(
      data.error,
      "Internal interview service authentication failed. Please contact the site owner.",
    );
  });

  it("returns 503 when upstream reports interview simulator is disabled or unavailable", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async () => {
      throw new AIServiceClientError("Disabled by configuration", {
        status: 503,
        code: "INTERVIEW_SIMULATOR_DISABLED",
        isUnavailable: true,
      });
    };

    const req = createRequest({ track: "full_stack" }, { ip: "192.168.1.110" });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "INTERVIEW_SIMULATOR_DISABLED");
  });

  it("returns 502 UPSTREAM_ERROR when upstream returns invalid schema", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async () => {
      throw new AIServiceClientError("Invalid response schema", {
        code: "INVALID_RESPONSE",
        isUnavailable: false,
      });
    };

    const req = createRequest({ track: "full_stack" }, { ip: "192.168.1.111" });
    const res = await POST(req);
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.code, "UPSTREAM_ERROR");
  });

  it("returns 429 RATE_LIMITED when rate limit threshold is exceeded", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.startInterview = async () => ({
      session_id: "s1",
      session_token: "tok-s1",
      track: "full_stack",
      total_questions: 10,
      initial_question: {
        question_id: "fs-mcq-01",
        question_number: 1,
        total_questions: 10,
        question_text: "Q1",
        question_type: "mcq",
        track: "full_stack",
        topic: "HTTP",
        options: ["A", "B", "C", "D"],
      },
    });

    const fixedIp = "192.168.1.199";
    // Default limit is 15
    for (let i = 0; i < 15; i++) {
      const res = await POST(createRequest({}, { ip: fixedIp }));
      assert.equal(res.status, 200);
    }

    const blockedRes = await POST(createRequest({}, { ip: fixedIp }));
    assert.equal(blockedRes.status, 429);
    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.ok(blockedRes.headers.get("Retry-After"));
  });
});
