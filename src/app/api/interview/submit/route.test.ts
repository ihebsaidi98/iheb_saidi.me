import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";
import { aiServiceClient, AIServiceClientError } from "@/lib/ai-service-client";

describe("POST /api/interview/submit — Secure Proxy Route", () => {
  const originalIsConfigured = aiServiceClient.isConfigured;
  const originalSubmitInterviewAnswer = aiServiceClient.submitInterviewAnswer;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TRUSTED_PROXY = "true";
    process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";
    delete process.env.AI_SERVICE_ENABLED;
  });

  afterEach(() => {
    aiServiceClient.isConfigured = originalIsConfigured;
    aiServiceClient.submitInterviewAnswer = originalSubmitInterviewAnswer;
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
    return new NextRequest("http://localhost:3000/api/interview/submit", {
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
    question_id: "fs-mcq-01",
    answer: "201 Created",
  };

  it("submits answer successfully and returns 200 with blind acknowledgement", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async (opts) => {
      assert.equal(opts.session_id, "session-12345");
      assert.equal(opts.session_token, "token-abc-987");
      assert.equal(opts.question_id, "fs-mcq-01");
      assert.equal(opts.answer, "201 Created");
      return {
        session_id: "session-12345",
        question_id: "fs-mcq-01",
        question_number: 1,
        answered_count: 1,
        total_questions: 10,
        is_complete: false,
        next_question: {
          question_id: "fs-mcq-02",
          question_number: 2,
          total_questions: 10,
          question_text: "When does a component re-render?",
          question_type: "mcq",
          track: "full_stack",
          topic: "React State",
          options: ["A", "B", "C", "D"],
        },
      };
    };

    const req = createRequest(validPayload, { ip: "192.168.1.201" });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.session_id, "session-12345");
    assert.equal(data.answered_count, 1);
    assert.equal(data.is_complete, false);
    assert.equal(data.next_question.question_id, "fs-mcq-02");
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
      headers: { "content-length": "70000" }, // exceeds MAX_SUBMIT_BODY_SIZE (65536)
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
    assert.match(data.error, /session_id/);
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
    assert.match(data.error, /session_token/);
  });

  it("returns 422 Validation Error when question_id is missing or empty", async () => {
    const req = createRequest(
      { ...validPayload, question_id: "" },
      { ip: "192.168.1.205" },
    );
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.match(data.error, /question_id/);
  });

  it("returns 422 Validation Error when answer is empty", async () => {
    const req = createRequest(
      { ...validPayload, answer: "" },
      { ip: "192.168.1.206" },
    );
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.match(data.error, /at least 1 character/);
  });

  it("returns 422 Validation Error when answer exceeds 3000 characters", async () => {
    const longAnswer = "a".repeat(3001);
    const req = createRequest(
      { ...validPayload, answer: longAnswer },
      { ip: "192.168.1.207" },
    );
    const res = await POST(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.match(data.error, /at most 3000 characters/);
  });

  it("sanitizes null bytes and control chars from candidate answer", async () => {
    aiServiceClient.isConfigured = () => true;
    let interceptedAnswer = "";
    aiServiceClient.submitInterviewAnswer = async (opts) => {
      interceptedAnswer = opts.answer;
      return {
        session_id: "s1",
        question_id: "q1",
        question_number: 1,
        answered_count: 1,
        total_questions: 10,
        is_complete: false,
      };
    };

    const dirtyAnswer = "Valid technical answer with null byte \0 and control chars \x07 included.";
    const req = createRequest(
      { ...validPayload, answer: dirtyAnswer },
      { ip: "192.168.1.208" },
    );
    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(!interceptedAnswer.includes("\0"));
    assert.ok(!interceptedAnswer.includes("\x07"));
  });

  it("returns 503 SERVICE_UNAVAILABLE when AI service is not configured", async () => {
    aiServiceClient.isConfigured = () => false;
    const req = createRequest(validPayload, { ip: "192.168.1.209" });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "SERVICE_UNAVAILABLE");
  });

  it("returns 500 AUTH_ERROR and does not leak credentials when upstream returns 401", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
      throw new AIServiceClientError("Unauthorized internal token", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.210" });
    const res = await POST(req);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.code, "AUTH_ERROR");
    assert.equal(
      data.error,
      "Internal interview service authentication failed. Please contact the site owner.",
    );
  });

  it("returns 503 when upstream reports unavailable", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
      throw new AIServiceClientError("Upstream service unavailable", {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        isUnavailable: true,
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.211" });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "SERVICE_UNAVAILABLE");
  });

  it("returns 502 UPSTREAM_ERROR when upstream returns invalid schema", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
      throw new AIServiceClientError("Invalid response schema", {
        code: "INVALID_RESPONSE",
        isUnavailable: false,
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.212" });
    const res = await POST(req);
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.code, "UPSTREAM_ERROR");
  });

  it("returns 429 RATE_LIMITED when rate limit threshold is exceeded", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => ({
      session_id: "s1",
      question_id: "q1",
      question_number: 1,
      answered_count: 1,
      total_questions: 10,
      is_complete: false,
    });

    const fixedIp = "192.168.1.29";
    for (let i = 0; i < 15; i++) {
      const res = await POST(createRequest(validPayload, { ip: fixedIp }));
      assert.equal(res.status, 200);
    }

    const blockedRes = await POST(createRequest(validPayload, { ip: fixedIp }));
    assert.equal(blockedRes.status, 429);
    const data = await blockedRes.json();
    assert.equal(data.code, "RATE_LIMITED");
    assert.ok(blockedRes.headers.get("Retry-After"));
  });

  it("forwards upstream 403 TOKEN_MISMATCH with clean message", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
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
    assert.equal(data.error, "Session token verification failed.");
  });

  it("forwards upstream 404 SESSION_NOT_FOUND error with clean message", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
      throw new AIServiceClientError("Interview session 'session-123' not found or has expired.", {
        status: 404,
        code: "SESSION_NOT_FOUND",
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.220" });
    const res = await POST(req);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.code, "SESSION_NOT_FOUND");
    assert.equal(data.error, "Interview session 'session-123' not found or has expired.");
  });

  it("forwards upstream 409 QUESTION_ALREADY_ANSWERED error with clean message", async () => {
    aiServiceClient.isConfigured = () => true;
    aiServiceClient.submitInterviewAnswer = async () => {
      throw new AIServiceClientError("Question 'fs-mcq-01' has already been evaluated for this session.", {
        status: 409,
        code: "QUESTION_ALREADY_ANSWERED",
      });
    };

    const req = createRequest(validPayload, { ip: "192.168.1.221" });
    const res = await POST(req);
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.code, "QUESTION_ALREADY_ANSWERED");
    assert.equal(data.error, "Question 'fs-mcq-01' has already been evaluated for this session.");
  });
});
