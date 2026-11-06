/**
 * src/lib/csp.test.ts
 *
 * AUD-06 — the enforced Content-Security-Policy must stop allowing inline
 * scripts, without losing any of the directives it already had.
 *
 * The contract pinned here:
 *
 *   C1 — production `script-src` is `'self'` plus a per-request `'nonce-…'`,
 *        and no directive other than `style-src` allows `'unsafe-inline'`.
 *   C2 — every other directive keeps exactly the sources it had before
 *        AUD-06 (default-src, base-uri, object-src, frame-ancestors,
 *        form-action, style-src, img-src, font-src, connect-src, worker-src,
 *        upgrade-insecure-requests, report-uri, report-to).
 *   C3 — development keeps its pre-existing relaxations (`'unsafe-eval'`,
 *        widened `connect-src`, no `upgrade-insecure-requests`). That is the
 *        documented exception, not a drift: the dev server injects its own
 *        tooling before Next renders.
 *   C4 — the nonce is 128 bits of base64, matches the pattern Next.js 15.5.28
 *        itself parses out of the CSP header, and is never reused.
 *   C5 — the layout hands that same nonce to the inline JSON-LD block, so no
 *        inline script survives without one.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/csp.test.ts
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  CSP_NONCE_BYTES,
  CSP_NONCE_HEADER,
  CSP_REPORT_PATH,
  buildContentSecurityPolicy,
  generateNonce,
} from "./csp";

const ROOT = process.cwd();

function readFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * Next.js 15.5.28 extracts the nonce with this exact pattern, from the first
 * `script-src` directive (falling back to `default-src`):
 *   node_modules/next/dist/server/app-render/get-script-nonce-from-header.js
 * A nonce that does not match it is silently dropped and every inline script
 * Next.js emits would then be blocked.
 */
const NEXT_NONCE_SOURCE = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;

/** Fixed, well-formed base64 nonce so the header string is deterministic. */
const NONCE = "dGVzdC1ub25jZS0xMjM0NTY3OA==";

function parseDirectives(csp: string): Map<string, string[]> {
  const parsed = new Map<string, string[]>();
  for (const rawDirective of csp.split(";")) {
    const parts = rawDirective.trim().split(/\s+/).filter(Boolean);
    const [name, ...sources] = parts;
    if (!name) continue;
    assert.equal(parsed.has(name), false, `directive ${name} must not be emitted twice`);
    parsed.set(name, sources);
  }
  return parsed;
}

function scriptNonce(csp: string): string {
  const token = (parseDirectives(csp).get("script-src") ?? []).find((source) =>
    source.startsWith("'nonce-"),
  );
  assert.ok(token, "script-src must carry a 'nonce-…' source");
  const match = token.match(NEXT_NONCE_SOURCE);
  assert.ok(match, `script-src nonce ${token} must match the pattern Next.js parses`);
  return match[1]!;
}

describe("production CSP (AUD-06)", () => {
  const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: false });
  const directives = parseDirectives(csp);

  it("allows scripts by nonce only", () => {
    assert.deepEqual(directives.get("script-src"), ["'self'", `'nonce-${NONCE}'`]);
    assert.ok(
      !csp.includes("script-src 'self' 'unsafe-inline'"),
      "production script-src must never fall back to 'unsafe-inline'",
    );
  });

  it("does not allow 'unsafe-inline' anywhere except style-src", () => {
    for (const [name, sources] of directives) {
      if (name === "style-src") continue;
      assert.ok(
        !sources.includes("'unsafe-inline'"),
        `${name} must not allow 'unsafe-inline' (AUD-06)`,
      );
    }
    // Inline `style` attributes are rendered by the app itself (38 occurrences
    // in SSR output) and are not a script vector; style-src keeps the token.
    assert.deepEqual(directives.get("style-src"), ["'self'", "'unsafe-inline'"]);
  });

  it("keeps every other directive exactly as before AUD-06", () => {
    assert.deepEqual(
      directives,
      new Map<string, string[]>([
        ["default-src", ["'self'"]],
        ["base-uri", ["'self'"]],
        ["object-src", ["'none'"]],
        ["frame-ancestors", ["'none'"]],
        ["form-action", ["'self'"]],
        ["script-src", ["'self'", `'nonce-${NONCE}'`]],
        ["style-src", ["'self'", "'unsafe-inline'"]],
        ["img-src", ["'self'", "data:", "blob:"]],
        ["font-src", ["'self'"]],
        ["connect-src", ["'self'"]],
        ["worker-src", ["'self'", "blob:"]],
        ["upgrade-insecure-requests", []],
        ["report-uri", [CSP_REPORT_PATH]],
        ["report-to", ["csp-endpoint"]],
      ]),
    );
  });

  it("still reports violations through the existing endpoint", () => {
    assert.equal(CSP_REPORT_PATH, "/api/csp-report");
    assert.deepEqual(directives.get("report-uri"), ["/api/csp-report"]);
    assert.deepEqual(directives.get("report-to"), ["csp-endpoint"]);
  });

  it("uses the nonce exactly once, so it cannot leak into another directive", () => {
    assert.equal(csp.split(NONCE).length - 1, 1);
  });
});

describe("development CSP (AUD-06)", () => {
  const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: true });
  const directives = parseDirectives(csp);

  it("keeps the dev-only relaxations that already existed", () => {
    const scriptSrc = directives.get("script-src") ?? [];
    assert.ok(scriptSrc.includes("'unsafe-eval'"), "React Refresh needs 'unsafe-eval' in dev");
    assert.ok(scriptSrc.includes(`'nonce-${NONCE}'`), "the nonce is still emitted in dev");
    assert.deepEqual(directives.get("connect-src"), ["'self'", "ws:", "http:", "https:"]);
  });

  it("does not force https upgrades on a http:// dev server", () => {
    assert.equal(directives.has("upgrade-insecure-requests"), false);
  });
});

describe("nonce generation (AUD-06)", () => {
  it("is 128 bits of base64", () => {
    assert.equal(CSP_NONCE_BYTES, 16);
    const nonce = generateNonce();
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
    assert.equal(Buffer.from(nonce, "base64").length, CSP_NONCE_BYTES);
  });

  it("produces a value Next.js can parse out of the header", () => {
    const nonce = generateNonce();
    assert.deepEqual(scriptNonce(buildContentSecurityPolicy({ nonce, isDev: false })), nonce);
  });

  it("is never reused between requests", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(generateNonce());
    assert.equal(seen.size, 2000, "2000 consecutive nonces must all differ");
  });
});

describe("inline scripts carry the nonce (AUD-06)", () => {
  it("has exactly one policy producer left", () => {
    // Two concurrent policies would be intersected by the browser, and the
    // weaker one would keep the finding alive. "Producing" means writing the
    // header itself; documentation and violation reports do not count.
    const producers: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
        const relative = path.posix.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(relative);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
        if (/headers\.set\(\s*["']Content-Security-Policy["']/.test(readFile(relative))) {
          producers.push(relative);
        }
      }
    };
    walk("src");

    assert.deepEqual(producers, ["src/middleware.ts"]);
  });

  it("exposes the request header name the middleware and the layout share", () => {
    assert.equal(CSP_NONCE_HEADER, "x-nonce");
  });

  it("leaves no static Content-Security-Policy in next.config.mjs", () => {
    // Static headers are evaluated once, so a nonce cannot live there; keeping
    // a second, inline-allowing policy around would be intersected with the
    // enforced one and would keep the AUD-06 finding alive.
    const nextConfig = readFile("next.config.mjs");
    assert.doesNotMatch(nextConfig, /Content-Security-Policy/);
    assert.match(
      nextConfig,
      /Reporting-Endpoints/,
      "the static reporting endpoint declaration stays in next.config.mjs",
    );
  });

  it("gives the JSON-LD block the nonce read from that request header", () => {
    const layout = readFile("src/app/layout.tsx");
    assert.match(
      layout,
      /import\s*\{[^}]*headers[^}]*\}\s*from\s*"next\/headers"/,
      "the root layout must read request headers to obtain the nonce",
    );
    assert.match(
      layout,
      /\.get\((?:CSP_NONCE_HEADER|"x-nonce")\)/,
      `the layout must read ${CSP_NONCE_HEADER} from the request`,
    );
    assert.match(
      layout,
      /type="application\/ld\+json"[\s\S]{0,300}?nonce=\{nonce\}/,
      "the inline JSON-LD script must carry the per-request nonce",
    );
  });
});
