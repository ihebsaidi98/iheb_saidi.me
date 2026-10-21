import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { POST, GET } from "./route";
import { sanitizeCspReportData } from "@/lib/csp-report";

describe("POST /api/csp-report — VULN-02 CSP Violation Ingestion & Secret Redaction", () => {
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

    const request = new NextRequest("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: payload,
    });

    const response = await POST(request);
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

    const request = new NextRequest("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    const response = await POST(request);
    assert.equal(response.status, 204);
  });

  it("rejects unsupported media type with 415", async () => {
    const request = new NextRequest("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "plain text violation",
    });

    const response = await POST(request);
    assert.equal(response.status, 415);
  });

  it("rejects GET requests with 405 Method Not Allowed and sets Allow header", async () => {
    const response = await GET();
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });
});
