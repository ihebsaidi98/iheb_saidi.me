/**
 * src/lib/csp.ts
 *
 * AUD-06 — single source of truth for the enforced Content-Security-Policy.
 *
 * The policy used to be a static string in `next.config.mjs`. That file is
 * evaluated once (its `headers()` output is frozen into the build manifest), so
 * it cannot carry a per-request value — which is exactly why `script-src` had to
 * allow `'unsafe-inline'`: Next.js renders its RSC payload as inline
 * `<script>` blocks, and a static policy has no way to vouch for them.
 *
 * A nonce fixes that. It is minted here, one per request, and both consumed
 * paths are built from the same object so they cannot drift:
 *
 *   - `src/middleware.ts` puts it in the request `Content-Security-Policy`
 *     header (Next.js parses the nonce out of it and attaches it to every
 *     script it emits — see `get-script-nonce-from-header.js` in Next 15.5.28)
 *     and in the response header the browser enforces;
 *   - `src/app/layout.tsx` reads the same value back through `x-nonce` to sign
 *     the one inline script this repository owns itself (the JSON-LD block).
 *
 * Keep this module dependency-free: it is imported by the Edge middleware
 * bundle as well as by Node-rendered code.
 */

/** Request header carrying the nonce from the middleware to the app. */
export const CSP_NONCE_HEADER = "x-nonce";

/** Where browsers POST violation reports (`src/app/api/csp-report/route.ts`). */
export const CSP_REPORT_PATH = "/api/csp-report";

/** Nonce entropy in bytes. 16 bytes = 128 bits, encoded as 24 base64 chars. */
export const CSP_NONCE_BYTES = 16;

export interface ContentSecurityPolicyOptions {
  /** Per-request nonce, as produced by {@link generateNonce}. */
  nonce: string;
  /** `next dev` keeps two relaxations the dev server itself needs. */
  isDev: boolean;
}

/**
 * 128 random bits, base64-encoded (24 characters, including `==` padding).
 *
 * Base64 is what CSP expects for a nonce source, and it is also what Next.js
 * accepts: its parser only matches `'nonce-([A-Za-z0-9+/_-]+={0,2})'`.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(CSP_NONCE_BYTES);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Build the full enforced policy for one request.
 *
 * Every directive other than `script-src` (and the two dev-only relaxations
 * below) is byte-for-byte what `next.config.mjs` used to emit: AUD-06 removes
 * the inline-script allowance only, it does not re-open or narrow anything else.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
}: ContentSecurityPolicyOptions): string {
  // Kept from the static policy: `next dev` talks to its own HMR socket and to
  // http:// origins, and must not upgrade them to https.
  const connectSrc = isDev ? "'self' ws: http: https:" : "'self'";

  // In development the dev server injects tooling (webpack HMR / React Refresh)
  // outside the App Router render, so those scripts never receive the nonce;
  // `'unsafe-inline'` and `'unsafe-eval'` keep `next dev` working unchanged.
  // This branch cannot ship: `NODE_ENV` is inlined into the production
  // middleware bundle by `next build`.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    // Inline `style` attributes are rendered by the app itself (framer-motion
    // and the decorative layers), and CSS is not a script-execution vector:
    // the finding is about `script-src`, so this token stays.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    `report-uri ${CSP_REPORT_PATH}`,
    "report-to csp-endpoint",
  ].join("; ");
}
