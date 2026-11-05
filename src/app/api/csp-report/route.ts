/**
 * src/app/api/csp-report/route.ts
 *
 * Dedicated Content Security Policy (CSP) violation reporting endpoint.
 * Accepts violation payloads from browsers, redacts sensitive secrets/tokens,
 * logs actionable telemetry, and responds with 204 No Content.
 *
 * M2-02 / M2-04 hardening:
 *   - the per-IP quota is applied before anything touches the body;
 *   - the body is capped at MAX_CSP_REPORT_BYTES, both via a cheap
 *     `Content-Length` pre-flight and via a real byte counter while streaming,
 *     so a chunked request or a lying `Content-Length` cannot force the process
 *     to buffer an arbitrarily large payload in memory: at most
 *     MAX_CSP_REPORT_BYTES of text are accumulated, plus the single chunk that
 *     crossed the cap before the read was cancelled.
 *   - control order is quota (429) → announced size (413/400) → media type (415)
 *     → body read.
 */

import { NextRequest, NextResponse } from "next/server";
import { MAX_LOG_SNIPPET_CHARS, sanitizeCspReportData } from "@/lib/csp-report";
import { clientIpRateLimitKey, extractClientIp } from "@/lib/chat";
import { createRouteRateLimiter } from "@/lib/rate-limit-config";
import { checkContentLength } from "@/lib/interview-route-helpers";
import { readBodyWithLimit } from "@/lib/request-body";

export const dynamic = "force-dynamic";

/** Hard application-level cap. A real CSP report is a few hundred bytes. */
const MAX_CSP_REPORT_BYTES = 16 * 1024;

// Module-level singleton — persists across requests in the same process.
const { limit: CSP_REPORT_RATE_LIMIT, rateLimiter } = createRouteRateLimiter(
  "CSP_REPORT_RATE_LIMIT",
  60,
  "CSP_REPORT_RATE_WINDOW_MS",
  60_000,
);

function payloadTooLargeResponse(headers: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      error: `Payload too large. Maximum allowed size is ${MAX_CSP_REPORT_BYTES} bytes.`,
      code: "PAYLOAD_TOO_LARGE",
    },
    { status: 413, headers },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Client IP + quota first: never read a body for a request we will reject.
  let ip: string;
  try {
    ip = extractClientIp(request);
  } catch (err) {
    console.error("[csp-report] Client IP verification failed:", err);
    return NextResponse.json(
      {
        error: "Unable to process request: client IP cannot be verified safely.",
        code: "IP_VERIFICATION_FAILED",
      },
      { status: 500 },
    );
  }

  const rl = rateLimiter.check(clientIpRateLimitKey(ip));
  const rlHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(CSP_REPORT_RATE_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many CSP reports. Dropping report.",
        code: "RATE_LIMITED",
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          ...rlHeaders,
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  // 2. Cheap header-only rejection when the announced size is already too big.
  const lengthError = checkContentLength(request, MAX_CSP_REPORT_BYTES, rlHeaders);
  if (lengthError) return lengthError;

  // 3. Content type (unchanged behaviour).
  const contentType = request.headers.get("content-type") ?? "";

  const isValidContentType =
    contentType.includes("application/csp-report") ||
    contentType.includes("application/reports+json") ||
    contentType.includes("application/json");

  if (!isValidContentType) {
    return NextResponse.json(
      { error: "Unsupported Media Type. Expected application/csp-report or application/json." },
      { status: 415, headers: rlHeaders },
    );
  }

  try {
    // 4. Read with a real byte counter (covers chunked and lying Content-Length).
    const bodyResult = await readBodyWithLimit(request, MAX_CSP_REPORT_BYTES);
    if (bodyResult.tooLarge) {
      return payloadTooLargeResponse(rlHeaders);
    }

    const rawText = bodyResult.text;
    if (!rawText.trim()) {
      return new NextResponse(null, { status: 204, headers: rlHeaders });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If not strictly JSON, sanitize raw text snippet and log
      const safeSnippet = sanitizeCspReportData(rawText, MAX_LOG_SNIPPET_CHARS);
      console.warn(`[csp-report] Received non-JSON violation report: ${safeSnippet}`);
      return new NextResponse(null, { status: 204, headers: rlHeaders });
    }

    // Extract core fields from standard "csp-report" wrapper or Reporting API array
    const reportObj =
      parsed?.["csp-report"] ??
      (Array.isArray(parsed) ? parsed[0]?.body : parsed);

    const blockedUri = String(reportObj?.["blocked-uri"] ?? reportObj?.["blockedURI"] ?? "unknown");
    const violatedDirective = String(
      reportObj?.["violated-directive"] ?? reportObj?.["effectiveDirective"] ?? "unknown",
    );
    const documentUri = String(reportObj?.["document-uri"] ?? reportObj?.["documentURL"] ?? "unknown");

    const sanitizedBlocked = sanitizeCspReportData(blockedUri);
    const sanitizedDirective = sanitizeCspReportData(violatedDirective);
    const sanitizedDoc = sanitizeCspReportData(documentUri);

    console.warn(
      `[csp-report] CSP Violation: directive="${sanitizedDirective}", blocked="${sanitizedBlocked}", document="${sanitizedDoc}"`,
    );

    return new NextResponse(null, { status: 204, headers: rlHeaders });
  } catch (err) {
    console.error("[csp-report] Error processing violation report:", err);
    return new NextResponse(null, { status: 204, headers: rlHeaders });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for CSP violation reports." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
