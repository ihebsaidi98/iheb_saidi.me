/**
 * src/app/api/interview/complete/route.ts
 *
 * Secure proxy endpoint for completing an Interview Simulator session
 * and retrieving the comprehensive evaluation report.
 *
 * POST /api/interview/complete
 */

import { NextRequest, NextResponse } from "next/server";
import { aiServiceClient, AIServiceClientError } from "@/lib/ai-service-client";
import { InMemoryRateLimiter, extractClientIp } from "@/lib/chat";
import {
  MAX_COMPLETE_BODY_SIZE,
  validateCompleteInterviewRequest,
} from "@/lib/interview";

const RATE_LIMIT = parseInt(process.env.INTERVIEW_RATE_LIMIT ?? "15", 10);
const RATE_WINDOW_MS = parseInt(
  process.env.INTERVIEW_RATE_WINDOW_MS ?? "60000",
  10,
);

const rateLimiter = new InMemoryRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);
rateLimiter.startAutoCleanup();

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Enforce content-length limit before body parsing
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_COMPLETE_BODY_SIZE) {
    return NextResponse.json(
      {
        error: `Payload too large. Maximum allowed size is ${MAX_COMPLETE_BODY_SIZE} bytes.`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  // 2. Client IP extraction & Rate limiting
  let ip: string;
  try {
    ip = extractClientIp(request);
  } catch (err) {
    console.error("[interview/complete] Client IP verification failed:", err);
    return NextResponse.json(
      {
        error: "Unable to process request: client IP cannot be verified safely.",
        code: "IP_VERIFICATION_FAILED",
      },
      { status: 500 },
    );
  }

  const rl = rateLimiter.check(ip);
  const rlHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before completing another session.",
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

  // 3. Parse JSON body
  let rawBody: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_COMPLETE_BODY_SIZE) {
      return NextResponse.json(
        {
          error: `Payload too large. Maximum allowed size is ${MAX_COMPLETE_BODY_SIZE} bytes.`,
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413, headers: rlHeaders },
      );
    }
    rawBody = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON in request body.",
        code: "BAD_REQUEST",
      },
      { status: 400, headers: rlHeaders },
    );
  }

  // 4. Validate body
  const validation = validateCompleteInterviewRequest(rawBody);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.error,
        code: "VALIDATION_ERROR",
      },
      { status: validation.status, headers: rlHeaders },
    );
  }

  // 5. Verify AI Service configuration
  if (!aiServiceClient.isConfigured()) {
    console.warn(
      "[interview/complete] AI Service is not configured (AI_SERVICE_URL unset or AI_SERVICE_ENABLED=false)",
    );
    return NextResponse.json(
      {
        error: "Interview Simulator capability is currently unavailable.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: rlHeaders },
    );
  }

  // 6. Delegate to FastAPI microservice
  try {
    const correlationId =
      request.headers.get("x-request-id") ??
      `web-interview-complete-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const result = await aiServiceClient.completeInterviewSession({
      ...validation.data,
      requestId: correlationId,
    });

    return NextResponse.json(result, { status: 200, headers: rlHeaders });
  } catch (err) {
    if (err instanceof AIServiceClientError) {
      if (err.code === "TOKEN_MISMATCH") {
        const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
        return NextResponse.json(
          {
            error: cleanMessage,
            code: "TOKEN_MISMATCH",
          },
          { status: 403, headers: rlHeaders },
        );
      }

      if (err.status === 401 || err.status === 403) {
        console.error(
          `[interview/complete] Upstream auth rejected (${err.code}):`,
          err.message,
        );
        return NextResponse.json(
          {
            error:
              "Internal interview service authentication failed. Please contact the site owner.",
            code: "AUTH_ERROR",
          },
          { status: 500, headers: rlHeaders },
        );
      }

      if (err.code === "INVALID_RESPONSE") {
        console.error("[interview/complete] Upstream invalid response:", err.message);
        return NextResponse.json(
          {
            error: "Upstream interview service returned an unexpected response format.",
            code: "UPSTREAM_ERROR",
          },
          { status: 502, headers: rlHeaders },
        );
      }

      if (err.isUnavailable || err.status === 503) {
        const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
        return NextResponse.json(
          {
            error: cleanMessage,
            code: err.code || "SERVICE_UNAVAILABLE",
          },
          { status: 503, headers: rlHeaders },
        );
      }

      if (err.status && err.status >= 400 && err.status < 500) {
        const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
        return NextResponse.json(
          {
            error: cleanMessage,
            code: err.code || "REQUEST_ERROR",
          },
          { status: err.status, headers: rlHeaders },
        );
      }
    }

    console.error("[interview/complete] Unexpected failure:", err);
    return NextResponse.json(
      {
        error: "Failed to complete technical interview session.",
        code: "INTERVIEW_ERROR",
      },
      { status: 502, headers: rlHeaders },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "Method Not Allowed. Use POST to complete an interview session.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    },
  );
}
