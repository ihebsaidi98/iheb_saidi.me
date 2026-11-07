/**
 * src/middleware.ts
 *
 * AUD-06 — mint a fresh CSP nonce per request and hand it to both sides.
 *
 * Why middleware: a nonce must differ on every response, so it cannot live in
 * `next.config.mjs` (evaluated once, output frozen in the build manifest). The
 * middleware runs before the render and can rewrite the request headers that
 * Next.js reads.
 *
 * Next.js 15.5.28 takes the nonce from the *request* `Content-Security-Policy`
 * header (`app-render.js`: `headers['content-security-policy']`, parsed by
 * `get-script-nonce-from-header.js`), then attaches it to the framework
 * scripts, the page chunks and the inline RSC payload. The response header
 * below is the policy the browser enforces. `x-nonce` exposes the same value to
 * app code (`src/app/layout.tsx` signs its inline JSON-LD block with it).
 *
 * Consequence, documented in README: nonces require dynamic rendering, so the
 * pages under the root layout are server-rendered per request instead of being
 * served from a prerendered HTML file.
 */

import { NextResponse, type NextRequest } from "next/server";

import { CSP_NONCE_HEADER, buildContentSecurityPolicy, generateNonce } from "@/lib/csp";

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  // Read by Next.js itself to sign the scripts it emits.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Enforced policy (never `Content-Security-Policy-Report-Only`).
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  /**
   * Document routes only. `_next/static` and `_next/image` are immutable
   * assets that never carry inline scripts, and `favicon.ico` is not a
   * document. Prefetches are RSC payloads, not documents: Next.js recommends
   * skipping them so a nonce is only minted for a real navigation.
   */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
