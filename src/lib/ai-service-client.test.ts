import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { AIServiceClient } from "./ai-service-client";

describe("AIServiceClient", () => {
  it("initializes with default localhost URL and token", () => {
    const client = new AIServiceClient();
    assert.ok(client);
  });

  it("handles trailing slashes cleanly", () => {
    const client = new AIServiceClient({ baseUrl: "http://example.com:8000///" });
    // @ts-expect-error accessing private field for assertion
    assert.equal(client.baseUrl, "http://example.com:8000");
  });

  it("injects X-Internal-Token on getServiceInfo", async () => {
    const originalFetch = globalThis.fetch;
    let interceptedHeaders: Headers | undefined;
    let interceptedUrl: string | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      interceptedUrl = String(input);
      interceptedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          service: "portfolio-ai-service",
          version: "0.1.0",
          phase: 1,
          environment: "test",
          active_chat_model: "gemini-3.5-flash-lite",
          active_embedding_model: "gemini-embedding-001",
          capabilities: ["health_probes"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const client = new AIServiceClient({
        baseUrl: "http://127.0.0.1:8000",
        token: "custom-secret-token",
      });

      const info = await client.getServiceInfo({ requestId: "trace-999" });
      assert.equal(interceptedUrl, "http://127.0.0.1:8000/v1/info");
      assert.equal(interceptedHeaders?.get("X-Internal-Token"), "custom-secret-token");
      assert.equal(interceptedHeaders?.get("X-Request-ID"), "trace-999");
      assert.equal(info.service, "portfolio-ai-service");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles non-200 responses with structured error messages", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or missing internal service authentication token.",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const client = new AIServiceClient();
      await assert.rejects(
        () => client.getServiceInfo(),
        /\[AIServiceClient\] Invalid or missing internal service authentication token\./,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe("isConfigured", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns false by default when no URL or options provided", () => {
      delete process.env.AI_SERVICE_URL;
      delete process.env.AI_SERVICE_ENABLED;
      const client = new AIServiceClient();
      assert.equal(client.isConfigured(), false);
    });

    it("returns true when baseUrl option is provided", () => {
      const client = new AIServiceClient({ baseUrl: "http://127.0.0.1:8001" });
      assert.equal(client.isConfigured(), true);
    });

    it("returns true when AI_SERVICE_URL env var is provided", () => {
      process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";
      const client = new AIServiceClient();
      assert.equal(client.isConfigured(), true);
    });

    it("returns false when AI_SERVICE_ENABLED is false", () => {
      process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";
      process.env.AI_SERVICE_ENABLED = "false";
      const client = new AIServiceClient();
      assert.equal(client.isConfigured(), false);
    });
  });

  describe("askRag", () => {
    it("successfully sends ChatRequest and parses ChatResponse", async () => {
      const originalFetch = globalThis.fetch;
      let interceptedUrl: string | undefined;
      let interceptedHeaders: Headers | undefined;
      let interceptedBody: string | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        interceptedUrl = String(input);
        interceptedHeaders = new Headers(init?.headers);
        interceptedBody = String(init?.body);
        return new Response(
          JSON.stringify({
            reply: "Iheb Saidi is a software engineer with expertise in TypeScript and Python.",
            sources: [
              {
                id: "profile-overview",
                title: "Professional Profile",
                type: "profile",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient({
          baseUrl: "http://127.0.0.1:8001",
          token: "secret-token",
        });

        const res = await client.askRag("What are Iheb's skills?", {
          limit: 5,
          threshold: 0.4,
          history: [{ role: "user", content: "Hi" }],
          requestId: "req-123",
        });

        assert.equal(interceptedUrl, "http://127.0.0.1:8001/v1/rag/chat");
        assert.equal(interceptedHeaders?.get("X-Internal-Token"), "secret-token");
        assert.equal(interceptedHeaders?.get("X-Request-ID"), "req-123");
        assert.equal(interceptedHeaders?.get("Content-Type"), "application/json");

        const parsedBody = JSON.parse(interceptedBody!);
        assert.equal(parsedBody.message, "What are Iheb's skills?");
        assert.equal(parsedBody.limit, 5);
        assert.equal(parsedBody.threshold, 0.4);
        assert.equal(parsedBody.history.length, 1);

        assert.equal(
          res.reply,
          "Iheb Saidi is a software engineer with expertise in TypeScript and Python.",
        );
        assert.equal(res.sources.length, 1);
        assert.equal(res.sources[0].id, "profile-overview");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=false on HTTP 401 Unauthorized", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid or missing internal service authentication token.",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.status, 401);
            assert.equal(err.code, "UNAUTHORIZED");
            assert.equal(err.isUnavailable, false);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=false on HTTP 403 Forbidden", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "Access forbidden.",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.status, 403);
            assert.equal(err.code, "FORBIDDEN");
            assert.equal(err.isUnavailable, false);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=true on HTTP 503 Service Unavailable", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "AI service is temporarily unavailable.",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.status, 503);
            assert.equal(err.code, "SERVICE_UNAVAILABLE");
            assert.equal(err.isUnavailable, true);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=true on network connection failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new TypeError("fetch failed");
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.isUnavailable, true);
            assert.equal(err.code, "UNAVAILABLE");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=true on timeout", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_input, init) => {
        // Wait until aborted
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello", { timeoutMs: 20 }),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.isUnavailable, true);
            assert.equal(err.code, "TIMEOUT");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with code=INVALID_RESPONSE on malformed JSON payload", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        // Return valid HTTP 200, but wrong schema (reply is missing)
        return new Response(JSON.stringify({ notReply: "Missing reply field" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.isUnavailable, false);
            assert.equal(err.code, "INVALID_RESPONSE");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with code=INVALID_RESPONSE on malformed sources", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ reply: "Hello", sources: [{ invalid: "source" }] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.askRag("Hello"),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.isUnavailable, false);
            assert.equal(err.code, "INVALID_RESPONSE");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("startInterview", () => {
    it("successfully initializes an interview session and returns initial question", async () => {
      const originalFetch = globalThis.fetch;
      let interceptedUrl: string | undefined;
      let interceptedBody: string | undefined;
      let interceptedHeaders: Headers | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        interceptedUrl = String(input);
        interceptedBody = String(init?.body);
        interceptedHeaders = new Headers(init?.headers);
        return new Response(
          JSON.stringify({
            session_id: "session-abc-123",
            session_token: "token-secret-123",
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient({
          baseUrl: "http://127.0.0.1:8001",
          token: "test-token-xyz",
        });

        const res = await client.startInterview({
          track: "full_stack",
          focus_areas: ["Next.js", "Docker"],
          requestId: "trace-int-1",
        });

        assert.equal(interceptedUrl, "http://127.0.0.1:8001/v1/interview/start");
        assert.equal(interceptedHeaders?.get("X-Internal-Token"), "test-token-xyz");
        assert.equal(interceptedHeaders?.get("X-Request-ID"), "trace-int-1");
        assert.deepEqual(JSON.parse(interceptedBody || "{}"), {
          track: "full_stack",
          focus_areas: ["Next.js", "Docker"],
        });

        assert.equal(res.session_id, "session-abc-123");
        assert.equal(res.session_token, "token-secret-123");
        assert.equal(res.track, "full_stack");
        assert.equal(res.initial_question.question_id, "fs-mcq-01");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError on HTTP 401 unauthorized", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid internal service token.",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.startInterview(),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.status, 401);
            assert.equal(err.code, "UNAUTHORIZED");
            assert.equal(err.isUnavailable, false);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError with isUnavailable=true on HTTP 503", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "INTERVIEW_SIMULATOR_DISABLED",
              message: "Adaptive Interview Simulator capability is disabled.",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.startInterview(),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.status, 503);
            assert.equal(err.isUnavailable, true);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError on malformed response schema", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ session_id: "s1" /* missing initial_question */ }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () => client.startInterview(),
          (err: any) => {
            assert.equal(err.name, "AIServiceClientError");
            assert.equal(err.code, "INVALID_RESPONSE");
            assert.equal(err.isUnavailable, false);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("submitInterviewAnswer", () => {
    it("successfully submits answer blindly and returns acknowledgement", async () => {
      const originalFetch = globalThis.fetch;
      let interceptedUrl: string | undefined;
      let interceptedBody: string | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        interceptedUrl = String(input);
        interceptedBody = String(init?.body);
        return new Response(
          JSON.stringify({
            session_id: "session-abc-123",
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        const res = await client.submitInterviewAnswer({
          session_id: "session-abc-123",
          session_token: "token-abc-123",
          question_id: "fs-mcq-01",
          answer: "201 Created",
          requestId: "sub-1",
        });

        assert.equal(interceptedUrl, "http://127.0.0.1:8001/v1/interview/submit-answer");
        assert.deepEqual(JSON.parse(interceptedBody || "{}"), {
          session_id: "session-abc-123",
          session_token: "token-abc-123",
          question_id: "fs-mcq-01",
          answer: "201 Created",
        });

        assert.equal(res.session_id, "session-abc-123");
        assert.equal(res.answered_count, 1);
        assert.equal(res.is_complete, false);
        assert.equal(res.next_question?.question_id, "fs-mcq-02");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError on HTTP 401", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Denied." } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () =>
            client.submitInterviewAnswer({
              session_id: "s1",
              session_token: "t1",
              question_id: "q1",
              answer: "Detailed answer here...",
            }),
          (err: any) => {
            assert.equal(err.status, 401);
            assert.equal(err.code, "UNAUTHORIZED");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws AIServiceClientError on malformed response schema", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ session_id: "s1" /* missing answered_count */ }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        await assert.rejects(
          async () =>
            client.submitInterviewAnswer({
              session_id: "s1",
              session_token: "t1",
              question_id: "q1",
              answer: "Detailed answer here...",
            }),
          (err: any) => {
            assert.equal(err.code, "INVALID_RESPONSE");
            assert.equal(err.isUnavailable, false);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("completeInterviewSession", () => {
    it("successfully completes session and returns report", async () => {
      const originalFetch = globalThis.fetch;
      let interceptedUrl: string | undefined;
      let interceptedBody: string | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        interceptedUrl = String(input);
        interceptedBody = String(init?.body);
        return new Response(
          JSON.stringify({
            session_id: "session-abc-123",
            track: "full_stack",
            score_out_of_100: 85.0,
            mcq_score: 45.0,
            written_score: 40.0,
            mcq_results: [],
            written_results: [],
            topic_breakdown: [],
            overall_strengths: ["Great"],
            overall_improvements: [],
            total_questions: 10,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new AIServiceClient();
        const res = await client.completeInterviewSession({
          session_id: "session-abc-123",
          session_token: "token-abc-123",
        });

        assert.equal(interceptedUrl, "http://127.0.0.1:8001/v1/interview/complete");
        assert.deepEqual(JSON.parse(interceptedBody || "{}"), {
          session_id: "session-abc-123",
          session_token: "token-abc-123",
        });

        assert.equal(res.session_id, "session-abc-123");
        assert.equal(res.score_out_of_100, 85.0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
