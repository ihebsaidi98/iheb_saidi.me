/**
 * src/lib/request-origin.ts
 *
 * AUD-12 — cross-origin request policy for the mutating API routes.
 *
 * Threat model. The application has no browser credential (no cookie, no
 * Authorization header, no session in `localStorage` that a form post could
 * ride), so classic CSRF — "the browser attaches the victim's credential to an
 * attacker-chosen request" — has nothing to attach. What remains is *forgery
 * without credentials*: any page can make a browser issue a POST to
 * `https://app/api/chat` and burn the owner's LLM credits, fill the interviewer
 * with sessions, or spam CSP reports.
 *
 * Browsers make this partially hard already: a `fetch` with
 * `Content-Type: application/json` triggers a CORS preflight, and no route
 * answers `OPTIONS`, so the real request is never sent. But a "simple" request
 * (`Content-Type: text/plain`, `application/x-www-form-urlencoded`, a plain
 * HTML form submit) skips the preflight entirely, so the handler does run.
 *
 * Policy (deliberately not "block everything without Origin"):
 *
 *   Sec-Fetch-Site: cross-site / simple-http-context   -> reject
 *   Sec-Fetch-Site: same-origin, none                  -> allow
 *   Sec-Fetch-Site: same-site or unknown value         -> fall through to Origin
 *   Origin present                                     -> must match our hostname
 *   Origin: null (sandboxed iframe, file://, redirect) -> reject
 *   Origin malformed / not http(s)                     -> reject
 *   Origin absent, Referer present                     -> Referer must match
 *   Origin absent, Referer absent                      -> allow
 *
 * Consequences that are intentional:
 *   - curl, monitoring, health probes, CI and any server-to-server caller send
 *     no `Origin` and keep working: they are not a browser, so there is no
 *     victim browser to forge from.
 *   - only the *hostname* is compared, not the full origin: the bundled Nginx
 *     forwards `Host $host` (no port) while the browser sends
 *     `Origin: http://localhost:3000`, and a TLS terminator in front of the app
 *     makes the app see `http://` where the browser sends `https://`. Comparing
 *     full origins would reject every legitimate request in those two supported
 *     deployments. A deployment serving the frontend from a *different
 *     hostname* is not supported by this policy.
 *   - the check runs before the rate limiter on purpose (see the routes): a
 *     rejected request must not consume the visitor's quota, otherwise a
 *     hostile page could exhaust a real visitor's budget.
 */
import { NextRequest, NextResponse } from "next/server";

/** Machine-readable code returned with the 403. */
export const CROSS_ORIGIN_REJECTION_CODE = "CROSS_ORIGIN_REJECTED";

/** Why a request was refused. Stable strings, safe to log and to assert on. */
export type OriginRejectionReason =
  | "cross-site"
  | "external-origin"
  | "null-origin"
  | "malformed-origin"
  | "external-referer";

export type OriginCheck = { allowed: true } | { allowed: false; reason: OriginRejectionReason };

/** `simple-http-context` is the legacy value Chromium sent before Fetch Metadata. */
const CROSS_SITE_FETCH_SITES = new Set(["cross-site", "simple-http-context"]);

type ParsedOrigin = { hostname: string };

function headerValue(request: NextRequest, name: string): string | null {
  const raw = request.headers.get(name);
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** Hostname of an absolute URL, lower-cased, or null when it cannot be parsed. */
function urlHostname(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Hostname this application answers on, from the URL Next.js built or from the proxy headers. */
function requestHostname(request: NextRequest): string | null {
  const fromUrl = urlHostname(request.url);
  if (fromUrl !== null) return fromUrl;
  for (const header of ["host", "x-forwarded-host"] as const) {
    const raw = headerValue(request, header);
    if (raw === null) continue;
    const parsed = urlHostname(`http://${raw}`);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Parse an `Origin` header value. An origin is `scheme://host[:port]` and
 * nothing else: browsers never send a path, credentials or a list.
 */
function parseOrigin(value: string): ParsedOrigin | { reason: OriginRejectionReason } {
  if (value.toLowerCase() === "null") {
    // Opaque origin: sandboxed iframe, file://, some redirect chains.
    return { reason: "null-origin" };
  }
  // Whitespace or a comma means several values or a corrupted header.
  if (/[\s,]/.test(value)) return { reason: "malformed-origin" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { reason: "malformed-origin" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return { reason: "malformed-origin" };
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return { reason: "malformed-origin" };
  if (url.username !== "" || url.password !== "") return { reason: "malformed-origin" };
  if (url.hostname === "") return { reason: "malformed-origin" };

  return { hostname: url.hostname.toLowerCase() };
}

/**
 * Decide whether a request may run. Pure: reads only the request headers.
 */
export function checkRequestOrigin(request: NextRequest): OriginCheck {
  const ownHostname = requestHostname(request);
  const fetchSite = (headerValue(request, "sec-fetch-site") ?? "").toLowerCase();

  // A browser stating it is cross-site is conclusive: the Origin header of the
  // same request can no longer be trusted to describe the initiator.
  if (CROSS_SITE_FETCH_SITES.has(fetchSite)) {
    return { allowed: false, reason: "cross-site" };
  }
  if (fetchSite === "same-origin" || fetchSite === "none") {
    return { allowed: true };
  }
  // `same-site` (a sibling subdomain: still a different origin) and unknown
  // values fall through to the Origin header.

  // Read the Origin header raw: a *present but blank* Origin is a malformed
  // header, not an absent one, and must not silently fall through to the
  // Referer/allow path below.
  const rawOrigin = request.headers.get("origin");
  if (rawOrigin !== null) {
    const parsed = parseOrigin(rawOrigin.trim());
    if ("reason" in parsed) return { allowed: false, reason: parsed.reason };
    // Fail closed when our own hostname cannot be determined.
    if (ownHostname === null || parsed.hostname !== ownHostname) {
      return { allowed: false, reason: "external-origin" };
    }
    return { allowed: true };
  }

  const referer = headerValue(request, "referer");
  if (referer !== null) {
    const refererHostname = urlHostname(referer);
    // An unparsable Referer carries no usable information (privacy tools and
    // some proxies rewrite it): ignore it rather than reject a real user.
    if (refererHostname !== null && (ownHostname === null || refererHostname !== ownHostname)) {
      return { allowed: false, reason: "external-referer" };
    }
  }

  // No browser metadata at all: curl, monitoring, server-to-server, CI.
  return { allowed: true };
}

/**
 * Standard 403 body for a refused request.
 *
 * No quota headers: the rejection happens before the rate limit is consumed.
 * The client origin is never echoed back into the body or into a log line.
 */
export function crossOriginRejectionResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Cross-origin request rejected. This endpoint only accepts requests from its own origin.",
      code: CROSS_ORIGIN_REJECTION_CODE,
    },
    { status: 403 },
  );
}

/**
 * Guard for a mutating route handler. Returns `null` when the request may run,
 * or the 403 response to return immediately. Call it as the first statement,
 * before the rate limit is consumed.
 */
export function rejectCrossOriginRequest(request: NextRequest): NextResponse | null {
  return checkRequestOrigin(request).allowed ? null : crossOriginRejectionResponse();
}
