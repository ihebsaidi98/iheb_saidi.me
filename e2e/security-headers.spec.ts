import { test, expect } from "@playwright/test";

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
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
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
  });
});
