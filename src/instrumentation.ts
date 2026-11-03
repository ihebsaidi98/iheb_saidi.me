/**
 * src/instrumentation.ts
 *
 * Next.js instrumentation hook — H3-3 / H3-4.
 *
 * `register()` validates the reverse-proxy configuration once, before the first
 * route module handles a request, so an unusable `TRUSTED_PROXY` or
 * `TRUSTED_PROXY_HEADER` fails with an explicit message instead of silently
 * turning proxy trust off (500 `IP_VERIFICATION_FAILED` on every rate-limited
 * route) or only failing on the first request that reads the header.
 *
 * Timing, as measured on Next.js 15.5.28:
 *   - `next build` never runs this hook: `registerInstrumentation()` returns
 *     early when `NEXT_PHASE === "phase-production-build"`, so a build without
 *     a generated env file stays green.
 *   - the hook is not executed at process start either: it runs on the first
 *     request served by a route module (`RouteModule.prepare()` ->
 *     `ensureInstrumentationRegistered()`), once per process. Static assets
 *     under `/_next/static` do not trigger it.
 *
 * This file is compiled twice when the app has Edge routes
 * (`src/app/opengraph-image.tsx` declares `runtime = "edge"`). Two guards keep
 * the validator out of the Edge bundle: `process.env.NEXT_RUNTIME` is inlined
 * per bundle, so this function is compiled to a no-op for the Edge chunk, and
 * `next.config.mjs` aliases `@/lib/env-config` to an empty module for the Edge
 * compilation, so the code is not even shipped there (a plain dynamic import
 * is inlined into the single-file Edge bundle otherwise, as verified on
 * 15.5.28). The hook also stays independent from `src/lib/chat.ts` so the
 * instrumentation bundle stays small.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateProxyEnv } = await import("@/lib/env-config");
  validateProxyEnv(process.env);
}
