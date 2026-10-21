/**
 * src/app/api/csp-report/route.ts
 *
 * Dedicated Content Security Policy (CSP) violation reporting endpoint.
 * Accepts violation payloads from browsers, redacts sensitive secrets/tokens,
 * logs actionable telemetry, and responds with 204 No Content.
 */

import { NextRequest, NextResponse } from "next/server";
import { sanitizeCspReportData } from "@/lib/csp-report";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";

  const isValidContentType =
    contentType.includes("application/csp-report") ||
    contentType.includes("application/reports+json") ||
    contentType.includes("application/json");

  if (!isValidContentType) {
    return NextResponse.json(
      { error: "Unsupported Media Type. Expected application/csp-report or application/json." },
      { status: 415 },
    );
  }

  try {
    const rawText = await request.text();
    if (!rawText.trim()) {
      return new NextResponse(null, { status: 204 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If not strictly JSON, sanitize raw text snippet and log
      const safeSnippet = sanitizeCspReportData(rawText.slice(0, 500));
      console.warn(`[csp-report] Received non-JSON violation report: ${safeSnippet}`);
      return new NextResponse(null, { status: 204 });
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

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[csp-report] Error processing violation report:", err);
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for CSP violation reports." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
