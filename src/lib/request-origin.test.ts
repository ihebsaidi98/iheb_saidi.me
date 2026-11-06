/**
 * src/lib/request-origin.test.ts
 *
 * AUD-12 — cross-origin request policy.
 *
 * The policy protects the mutating API routes against a page hosted on another
 * origin issuing a request the browser would send without a preflight (a
 * "simple" POST with `text/plain`, or a plain HTML form submit). Nothing is
 * blocked blindly: requests with no browser metadata at all (curl, monitoring,
 * server-to-server) stay allowed, because only a browser can be trusted to send
 * `Sec-Fetch-Site` / `Origin` consistently.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/request-origin.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { checkRequestOrigin, rejectCrossOriginRequest } from "./request-origin";

const APP = "http://localhost:3000/api/chat";

function request(headers: Record<string, string> = {}, url = APP): NextRequest {
  return new NextRequest(url, { method: "POST", headers, body: "{}" });
}

function reasonOf(req: NextRequest): string | null {
  const result = checkRequestOrigin(req);
  return result.allowed ? null : result.reason;
}

describe("checkRequestOrigin — non-browser clients", () => {
  it("allows a request with no Origin, Referer or Sec-Fetch-Site", () => {
    // curl, a health probe, a server-to-server call, Playwright's request API.
    assert.deepEqual(checkRequestOrigin(request()), { allowed: true });
  });

  it("allows a request that only carries unrelated headers", () => {
    assert.deepEqual(
      checkRequestOrigin(request({ "content-type": "application/json", "x-request-id": "abc" })),
      { allowed: true },
    );
  });
});

describe("checkRequestOrigin — fetch metadata (Sec-Fetch-Site)", () => {
  it("allows Sec-Fetch-Site: same-origin", () => {
    assert.deepEqual(checkRequestOrigin(request({ "sec-fetch-site": "same-origin" })), {
      allowed: true,
    });
  });

  it("allows Sec-Fetch-Site: none (typed URL, bookmark, non-browser)", () => {
    assert.deepEqual(checkRequestOrigin(request({ "sec-fetch-site": "none" })), { allowed: true });
  });

  it("rejects Sec-Fetch-Site: cross-site even when Origin claims our own origin", () => {
    assert.equal(
      reasonOf(request({ "sec-fetch-site": "cross-site", origin: "http://localhost:3000" })),
      "cross-site",
    );
  });

  it("rejects Sec-Fetch-Site: simple-http-context (legacy cross-site subresource)", () => {
    assert.equal(reasonOf(request({ "sec-fetch-site": "simple-http-context" })), "cross-site");
  });

  it("allows Sec-Fetch-Site: same-site only when Origin matches our hostname", () => {
    // same-site === same registrable domain, i.e. a sibling subdomain: still a
    // different origin, so the Origin header decides.
    assert.deepEqual(
      checkRequestOrigin(
        request({ "sec-fetch-site": "same-site", origin: "http://localhost:3000" }),
      ),
      { allowed: true },
    );
    assert.equal(
      reasonOf(request({ "sec-fetch-site": "same-site", origin: "http://evil.localhost" })),
      "external-origin",
    );
  });

  it("falls back to the Origin header when Sec-Fetch-Site has an unknown value", () => {
    assert.equal(
      reasonOf(request({ "sec-fetch-site": "weird-value", origin: "https://evil.example" })),
      "external-origin",
    );
    assert.deepEqual(
      checkRequestOrigin(request({ "sec-fetch-site": "weird-value", origin: "http://localhost:3000" })),
      { allowed: true },
    );
  });

  it("treats Sec-Fetch-Site case-insensitively and tolerates surrounding spaces", () => {
    assert.deepEqual(checkRequestOrigin(request({ "sec-fetch-site": "SAME-ORIGIN" })), {
      allowed: true,
    });
    assert.equal(reasonOf(request({ "sec-fetch-site": " Cross-Site " })), "cross-site");
  });
});

describe("checkRequestOrigin — Origin header", () => {
  it("allows an Origin identical to the request origin", () => {
    assert.deepEqual(checkRequestOrigin(request({ origin: "http://localhost:3000" })), {
      allowed: true,
    });
  });

  it("allows the same hostname on another port (nginx forwards Host as $host, without the port)", () => {
    // docker-compose publishes "3000:80" and nginx sets `Host $host`, so the
    // browser's Origin carries :3000 while the app sees `localhost`.
    assert.deepEqual(checkRequestOrigin(request({ origin: "http://localhost:8080" })), {
      allowed: true,
    });
  });

  it("allows the same hostname on another scheme (TLS terminated in front of the app)", () => {
    assert.deepEqual(checkRequestOrigin(request({ origin: "https://localhost" })), {
      allowed: true,
    });
  });

  it("compares hostnames case-insensitively", () => {
    assert.deepEqual(checkRequestOrigin(request({ origin: "http://LOCALHOST:3000" })), {
      allowed: true,
    });
  });

  it("rejects an Origin from another hostname", () => {
    assert.equal(reasonOf(request({ origin: "https://evil.example" })), "external-origin");
    assert.equal(reasonOf(request({ origin: "http://localhost.evil.example" })), "external-origin");
  });

  it("rejects a lookalike or sibling hostname", () => {
    assert.equal(reasonOf(request({ origin: "http://evil-localhost" })), "external-origin");
    assert.equal(
      reasonOf(request({ origin: "http://localhost.evil.example" })),
      "external-origin",
      "a hostname that merely starts with ours must not pass",
    );
    // An invalid port is not a valid origin at all, so it is reported as
    // malformed rather than merely external — still rejected either way.
    assert.equal(reasonOf(request({ origin: "http://localhost:3000.evil.example" })), "malformed-origin");
  });

  it("rejects the opaque 'null' origin (sandboxed iframe, file://, redirect chains)", () => {
    assert.equal(reasonOf(request({ origin: "null" })), "null-origin");
    assert.equal(reasonOf(request({ origin: "NULL" })), "null-origin");
  });

  it("rejects malformed Origin values", () => {
    assert.equal(reasonOf(request({ origin: "not a url" })), "malformed-origin");
    assert.equal(reasonOf(request({ origin: "http://" })), "malformed-origin");
    assert.equal(reasonOf(request({ origin: "//evil.example" })), "malformed-origin");
    assert.equal(
      reasonOf(request({ origin: "http://localhost:3000, https://evil.example" })),
      "malformed-origin",
    );
    assert.equal(reasonOf(request({ origin: "   " })), "malformed-origin");
  });
});

describe("checkRequestOrigin — Referer fallback", () => {
  it("rejects a cross-origin Referer when Origin is absent (old browsers, form posts)", () => {
    assert.equal(
      reasonOf(request({ referer: "https://evil.example/attack.html" })),
      "external-referer",
    );
  });

  it("allows a same-origin Referer when Origin is absent", () => {
    assert.deepEqual(
      checkRequestOrigin(request({ referer: "http://localhost:3000/?ref=portfolio" })),
      { allowed: true },
    );
  });

  it("lets Origin win over Referer when both are present", () => {
    assert.deepEqual(
      checkRequestOrigin(
        request({ origin: "http://localhost:3000", referer: "https://evil.example/x" }),
      ),
      { allowed: true },
    );
    assert.equal(
      reasonOf(request({ origin: "https://evil.example", referer: "http://localhost:3000/" })),
      "external-origin",
    );
  });

  it("ignores an unparsable Referer instead of blocking (privacy tools rewrite it)", () => {
    assert.deepEqual(checkRequestOrigin(request({ referer: "not a url" })), { allowed: true });
  });
});

describe("rejectCrossOriginRequest", () => {
  it("returns null when the request is allowed", () => {
    assert.equal(rejectCrossOriginRequest(request()), null);
    assert.equal(
      rejectCrossOriginRequest(request({ origin: "http://localhost:3000" })),
      null,
    );
  });

  it("returns a 403 JSON response for a cross-origin request", async () => {
    const res = rejectCrossOriginRequest(request({ origin: "https://evil.example" }));
    assert.ok(res, "a blocked request must produce a response");
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "CROSS_ORIGIN_REJECTED");
    assert.equal(typeof body.error, "string");
    assert.ok(body.error.length > 0);
  });

  it("does not leak the client origin back in the body", async () => {
    const res = rejectCrossOriginRequest(request({ origin: "https://evil.example" }));
    assert.ok(res);
    const text = JSON.stringify(await res.json());
    assert.equal(text.includes("evil.example"), false);
  });

  it("emits no quota headers: the rejection happens before the rate limit is consumed", () => {
    const res = rejectCrossOriginRequest(request({ origin: "https://evil.example" }));
    assert.ok(res);
    for (const header of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
      assert.equal(res.headers.get(header), null, `${header} must not be set before the quota check`);
    }
  });

  it("never emits a permissive CORS header", () => {
    const res = rejectCrossOriginRequest(request({ origin: "https://evil.example" }));
    assert.ok(res);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.equal(res.headers.get("access-control-allow-credentials"), null);
  });
});
