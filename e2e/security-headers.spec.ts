import { test, expect } from "@playwright/test";

/** The `script-src` directive of an enforced policy. */
function scriptSrcOf(csp: string): string {
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src"));

  if (!directive) throw new Error(`the policy carries no script-src: ${csp}`);
  return directive;
}

/** The nonce Next.js mints for this response, parsed the way Next.js parses it. */
function nonceOf(csp: string): string {
  const match = scriptSrcOf(csp).match(/'nonce-([A-Za-z0-9+/_-]+={0,2})'/);
  if (!match) throw new Error(`the policy carries no nonce: ${csp}`);
  return match[1];
}

test.describe("Production Security Headers", () => {
  test("serves strict enforced Content-Security-Policy and required security headers", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const headers = response.headers();

    // 1. Enforced Content-Security-Policy (must not be report-only)
    expect(headers["content-security-policy"]).toBeDefined();
    expect(headers["content-security-policy-report-only"]).toBeUndefined();

    const csp = headers["content-security-policy"];

    // AUD-06: scripts are allowed by `'self'` plus the per-request nonce only.
    // A statically served policy would have to keep `'unsafe-inline'`.
    const nonce = nonceOf(csp);
    expect(scriptSrcOf(csp)).toBe(`script-src 'self' 'nonce-${nonce}'`);
    expect(csp).not.toContain("'unsafe-inline'; script-src");
    expect(scriptSrcOf(csp)).not.toContain("unsafe-inline");
    expect(csp).not.toContain("'unsafe-eval'");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp-endpoint");

    // 2. Reporting-Endpoints
    expect(headers["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"');

    // 3. X-Content-Type-Options
    expect(headers["x-content-type-options"]).toBe("nosniff");

    // 4. Referrer-Policy
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // 5. X-Frame-Options
    expect(headers["x-frame-options"]).toBe("DENY");

    // 6. Permissions-Policy
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");

    // 7. No HSTS over plain HTTP (AUD-05). TLS is terminated outside this
    // repository (README → "HTTPS Termination & HSTS"): the terminator owns
    // the header, and browsers ignore it on an http:// response anyway. This
    // asserts the app does not serve a blind, scheme-independent HSTS header.
    expect(headers["strict-transport-security"]).toBeUndefined();
  });

  test("mints a fresh nonce per request and signs every inline script (AUD-06)", async ({
    request,
  }) => {
    const first = await request.get("/");
    const second = await request.get("/");
    expect(first.ok()).toBe(true);
    expect(second.ok()).toBe(true);

    // A reused nonce would let a cached document execute its own inline scripts
    // under another response's policy: the nonce must be minted per request.
    const firstNonce = nonceOf(first.headers()["content-security-policy"]);
    const secondNonce = nonceOf(second.headers()["content-security-policy"]);
    expect(firstNonce).not.toBe(secondNonce);

    // Such a document must never be stored by a shared cache.
    expect(first.headers()["cache-control"]).toMatch(/private|no-store/);

    const html = await first.text();

    // Every inline `<script>` (Next.js' own flight-data pushes and the app's
    // JSON-LD) has to carry the nonce of *this* response; an unsigned one is
    // blocked by the enforced policy.
    const inlineScripts = html.match(/<script(?![^>]*\ssrc=)[^>]*>/g) ?? [];
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const tag of inlineScripts) {
      expect(tag).toContain(`nonce="${firstNonce}"`);
    }

    const jsonLd = html.match(/<script[^>]*application\/ld\+json[^>]*>/)?.[0];
    expect(jsonLd).toBeDefined();
    expect(jsonLd).toContain(`nonce="${firstNonce}"`);

    // The second document must not carry the first request's nonce.
    expect(await second.text()).not.toContain(`nonce="${firstNonce}"`);
  });
});
