import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
});
