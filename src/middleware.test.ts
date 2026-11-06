/**
 * src/middleware.test.ts
 *
 * AUD-06 — the per-request nonce is minted by `src/middleware.ts` and handed to
 * Next.js in two places, because Next reads them for different purposes:
 *
 *   - the *request* `Content-Security-Policy` header is what Next.js parses to
 *     attach the nonce to the scripts it renders (app-render.js reads
 *     `headers['content-security-policy']`, see also
 *     get-script-nonce-from-header.js), and `x-nonce` is the one the app
 *     itself can read through `next/headers`;
 *   - the *response* header is what the browser actually enforces.
 *
 * These tests call the middleware directly and inspect the headers it returns,
 * including the `x-middleware-request-*` pair Next.js uses to apply the
 * rewritten request headers. They never start a server.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/middleware.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { config, middleware } from "./middleware";

const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/;

function call(pathname = "/"): Response {
  return middleware(new NextRequest(`https://portfolio.test${pathname}`));
}

function nonceOf(response: Response): string {
  const csp = response.headers.get("content-security-policy");
  assert.ok(csp, "the middleware must set an enforced Content-Security-Policy");
  const match = csp.match(NONCE_SOURCE);
  assert.ok(match, "the enforced policy must carry a nonce");
  return match[1]!;
}

describe("middleware CSP (AUD-06)", () => {
  it("serves the enforced policy, not a report-only one", () => {
    const response = call();
    assert.ok(response.headers.get("content-security-policy"));
    assert.equal(response.headers.get("content-security-policy-report-only"), null);
  });

  it("removes 'unsafe-inline' from script-src", () => {
    const csp = call().headers.get("content-security-policy")!;
    const scriptSrc = csp.split(";").map((part) => part.trim()).find((part) =>
      part.startsWith("script-src"),
    );
    assert.ok(scriptSrc, "script-src must be present");
    assert.ok(!scriptSrc!.includes("'unsafe-inline'"), `unexpected script-src: ${scriptSrc}`);
    assert.ok(scriptSrc!.includes("'nonce-"), `unexpected script-src: ${scriptSrc}`);
  });

  it("keeps the rest of the production policy intact", () => {
    const csp = call().headers.get("content-security-policy")!;
    for (const expected of [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ]) {
      assert.ok(csp.includes(expected), `the policy lost ${expected}`);
    }
  });

  it("hands the very same nonce to the rendered request", () => {
    const response = call();
    const nonce = nonceOf(response);
    // Next.js applies the rewritten request headers through these internal
    // headers; `headers()` in the app then sees `x-nonce`.
    assert.equal(response.headers.get("x-middleware-request-x-nonce"), nonce);
    assert.equal(
      response.headers.get("x-middleware-request-content-security-policy"),
      response.headers.get("content-security-policy"),
    );
    const overridden = response.headers.get("x-middleware-override-headers") ?? "";
    assert.ok(
      overridden.split(",").includes("x-nonce"),
      "x-nonce must be part of the overridden request headers",
    );
  });

  it("mints a fresh nonce for every request", () => {
    const first = call();
    const second = call();
    const firstNonce = nonceOf(first);
    const secondNonce = nonceOf(second);

    assert.notEqual(firstNonce, secondNonce);
    assert.ok(!second.headers.get("content-security-policy")!.includes(firstNonce));
    assert.ok(!first.headers.get("content-security-policy")!.includes(secondNonce));
  });

  it("covers every document route and skips the immutable asset paths", () => {
    const sources = config.matcher.map((entry) =>
      typeof entry === "string" ? entry : entry.source,
    );
    const pattern = sources.join(" ");
    for (const excluded of ["_next/static", "_next/image", "favicon.ico"]) {
      assert.ok(pattern.includes(excluded), `${excluded} must be excluded from the matcher`);
    }
  });
});
