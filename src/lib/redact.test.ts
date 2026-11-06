import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_KEY_PATTERN,
  BASIC_AUTH_PATTERN,
  BEARER_PATTERN,
  JWT_PATTERN,
  SENSITIVE_PARAM_PATTERN,
  redactSecrets,
  sanitizeLogMessage,
} from "./redact";

describe("src/lib/redact — redactSecrets()", () => {
  describe("Category 1: Google API keys", () => {
    it("redacts Google API keys starting with AIza followed by 35 valid characters", () => {
      const key = "AIzaSyD-1234567890abcdefghijklmnopqrstu";
      const input = `Error: Invalid API key ${key} provided in request.`;
      const result = redactSecrets(input);

      assert.ok(!result.includes(key), "original API key must not be present");
      assert.ok(result.includes("[REDACTED_API_KEY]"), "replacement token must be present");
    });

    it("redacts Google API key in query parameters", () => {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyD-1234567890abcdefghijklmnopqrstu";
      const result = redactSecrets(url);

      assert.ok(!result.includes("AIzaSyD-1234567890abcdefghijklmnopqrstu"));
      assert.ok(result.includes("key=[REDACTED_API_KEY]"));
    });
  });

  describe("Category 2: Bearer tokens", () => {
    it("redacts Bearer tokens with mixed casing and multiple spaces", () => {
      const inputs = [
        "Bearer eyJhbGciOiJIUzI1NiJ9.abc",
        "bearer   my-super-secret-token.123",
        "BEARER token_value_with_underscores-and.dots",
      ];

      for (const input of inputs) {
        const result = redactSecrets(input);
        assert.ok(!result.includes("my-super-secret-token.123"));
        assert.ok(!result.includes("token_value_with_underscores"));
        assert.match(result, /Bearer \[REDACTED_TOKEN\]/i);
      }
    });
  });

  describe("Category 3: HTTP Basic Authorization", () => {
    it("redacts Basic credentials with padding and varied spacing", () => {
      const inputs = [
        "Authorization: Basic dXNlcjpwYXNz",
        "authorization:   basic   dXNlcjpwYXNz",
        "Authorization: Basic dXNlcjpwYXNzMTIzNDU2Nzg5MA==",
        "https://example.com/redirect (Authorization: Basic dXNlcjpwYXNzMTIzNDU2Nzg5MA==)",
      ];

      for (const input of inputs) {
        const result = redactSecrets(input);
        assert.ok(!result.includes("dXNlcjpwYXNz"), "credential must not appear in output");
        assert.ok(
          result.includes("Authorization: Basic [REDACTED]"),
          "must use standard normalized replacement",
        );
      }
    });
  });

  describe("Category 4: Raw JWTs", () => {
    it("redacts bare JWTs in headers, query strings or free text", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const inputs = [
        `Token received: ${jwt}`,
        `https://example.com/callback?id_token=${jwt}`,
        `id=${jwt}&state=active`,
      ];

      for (const input of inputs) {
        const result = redactSecrets(input);
        assert.ok(!result.includes(jwt), "bare JWT must be redacted");
        assert.ok(result.includes("[REDACTED_JWT]"));
      }
    });
  });

  describe("Category 5: Sensitive Parameters", () => {
    it("redacts documented sensitive keys while preserving the key name", () => {
      const cases: Array<[string, string]> = [
        ["https://example.com/?password=hunter2&user=bob", "password=[REDACTED_SECRET]"],
        ["https://example.com/?passwd=p1", "passwd=[REDACTED_SECRET]"],
        ["https://example.com/?pwd=p2", "pwd=[REDACTED_SECRET]"],
        ["https://s3.example.com/x?X-Amz-Signature=deadbeef", "Signature=[REDACTED_SECRET]"],
        ["https://example.com/?sig=abcdef123456", "sig=[REDACTED_SECRET]"],
        ["https://example.com/?session=zzz999", "session=[REDACTED_SECRET]"],
        ["https://example.com/?auth=abc.def", "auth=[REDACTED_SECRET]"],
        ["https://example.com/?api_key=secretkey123", "api_key=[REDACTED_SECRET]"],
        ["https://example.com/?client_secret=topsecret", "client_secret=[REDACTED_SECRET]"],
        ["token=mytoken999", "token=[REDACTED_SECRET]"],
        ["&key=somekey456", "&key=[REDACTED_SECRET]"],
      ];

      for (const [input, expected] of cases) {
        const result = redactSecrets(input);
        assert.ok(result.includes(expected), `expected "${expected}" in "${result}" (input: ${input})`);
      }
    });

    it("redacts URL-encoded sensitive values entirely", () => {
      const input = "https://example.com/?key=abc%2Fdef%3D%26ghi";
      const result = redactSecrets(input);

      assert.ok(!result.includes("%2F"));
      assert.ok(!result.includes("%3D"));
      assert.ok(result.includes("key=[REDACTED_SECRET]"));
    });

    it("handles casing variations in parameter names", () => {
      assert.ok(redactSecrets("PASSWORD=hunter2").includes("PASSWORD=[REDACTED_SECRET]"));
      assert.ok(redactSecrets("Api_Key=abc").includes("Api_Key=[REDACTED_SECRET]"));
      assert.ok(redactSecrets("TOKEN=xyz").includes("TOKEN=[REDACTED_SECRET]"));
    });
  });

  describe("False Positive Protection", () => {
    it("does not redact ordinary words or benign parameters containing substring keys", () => {
      const benign = [
        "monkey=banana",
        "hockey=stick",
        "keyboard=mechanical",
        "donkey=kong",
        "token_type=Bearer",
        "user=alice&public_key=present", // public_key has _key so it is sensitive, but user is untouched
      ];

      assert.equal(redactSecrets("monkey=banana"), "monkey=banana");
      assert.equal(redactSecrets("hockey=stick"), "hockey=stick");
      assert.equal(redactSecrets("keyboard=mechanical"), "keyboard=mechanical");
      assert.equal(redactSecrets("donkey=kong"), "donkey=kong");
      assert.equal(redactSecrets("token_type=Bearer"), "token_type=Bearer");
    });
  });

  describe("Edge cases & robustness", () => {
    it("returns empty string when given empty string", () => {
      assert.equal(redactSecrets(""), "");
    });

    it("handles very long strings efficiently without ReDoS", () => {
      const longSafe = "a".repeat(100_000);
      const start = Date.now();
      const result = redactSecrets(longSafe);
      const duration = Date.now() - start;

      assert.equal(result.length, 100_000);
      assert.ok(duration < 500, `execution took ${duration}ms, expected < 500ms`);
    });

    it("preserves exact order and avoids double-redacting already redacted markers", () => {
      const input = "key=AIzaSyD-1234567890abcdefghijklmnopqrstu";
      const result = redactSecrets(input);
      // AIza pattern replaces first with [REDACTED_API_KEY], sensitive param pattern skips (?!\[REDACTED)
      assert.equal(result, "key=[REDACTED_API_KEY]");
    });
  });
});

describe("src/lib/redact — sanitizeLogMessage()", () => {
  it("redacts secrets and cleans control characters and CR/LF", () => {
    const raw =
      "LLM error: key=AIzaSyD-1234567890abcdefghijklmnopqrstu\r\n[429 RESOURCE_EXHAUSTED]\nOverloaded";
    const sanitized = sanitizeLogMessage(raw);

    assert.ok(!sanitized.includes("AIzaSyD"));
    assert.ok(sanitized.includes("key=[REDACTED_API_KEY]"));
    assert.ok(!sanitized.includes("\r"), "must not contain CR");
    assert.ok(!sanitized.includes("\n"), "must not contain LF");
    assert.ok(sanitized.includes("[429 RESOURCE_EXHAUSTED] Overloaded"));
  });

  it("strips ANSI escape codes, null bytes, and non-printable control chars", () => {
    const hostile = "Error:\u001b[31mFailed\u001b[0m with code \u0000 and DEL \u007F";
    const sanitized = sanitizeLogMessage(hostile);

    assert.ok(!sanitized.includes("\u001b"));
    assert.ok(!sanitized.includes("\u0000"));
    assert.ok(!sanitized.includes("\u007F"));
    assert.equal(sanitized, "Error: [31mFailed [0m with code and DEL");
  });

  it("strips Unicode bidi overrides and invisible line separators", () => {
    const bidiHostile = "Safe\u202Ereversed\u202C text\u2028line\u2029para\u0085nel";
    const sanitized = sanitizeLogMessage(bidiHostile);

    assert.doesNotMatch(sanitized, /[\u0085\u2028\u2029\u202A-\u202E\u2066-\u2069]/);
    assert.ok(sanitized.includes("Safereversed textlineparanel"));
  });

  it("preserves double and single quotes needed for structured error diagnostics", () => {
    const diagnostic = 'HTTP 400: {"error": {"message": "Invalid model", "code": 400}}';
    const sanitized = sanitizeLogMessage(diagnostic);

    assert.equal(sanitized, diagnostic, "quotes must not be transformed to single quotes");
    assert.ok(sanitized.includes('"error"'));
    assert.ok(sanitized.includes('"message"'));
  });

  it("does not apply arbitrary length truncation", () => {
    const longDiagnostic = `Diagnostic details: ${"x".repeat(1500)}`;
    const sanitized = sanitizeLogMessage(longDiagnostic);

    assert.equal(sanitized.length, longDiagnostic.length);
    assert.ok(!sanitized.includes("…[+"));
  });

  it("returns empty string when given empty string", () => {
    assert.equal(sanitizeLogMessage(""), "");
  });
});
