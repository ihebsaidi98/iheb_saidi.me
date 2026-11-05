/**
 * src/app/api/interview/complete/route.ts
 *
 * Secure proxy endpoint for completing an Interview Simulator session
 * and retrieving the comprehensive evaluation report.
 *
 * POST /api/interview/complete
 */

import { NextRequest, NextResponse } from "next/server";
import { aiServiceClient } from "@/lib/ai-service-client";
import { clientIpRateLimitKey, extractClientIp } from "@/lib/chat";
import { createRouteRateLimiter } from "@/lib/rate-limit-config";
import {
  MAX_COMPLETE_BODY_SIZE,
  validateCompleteInterviewRequest,
} from "@/lib/interview";
import {
  checkContentLength,
  parseJsonBody,
  validationErrorResponse,
  handleInterviewApiError,
  methodNotAllowedResponse,
} from "@/lib/interview-route-helpers";

const { limit: RATE_LIMIT, rateLimiter } = createRouteRateLimiter(
  "INTERVIEW_COMPLETE_RATE_LIMIT",
  2,
  "INTERVIEW_COMPLETE_RATE_WINDOW_MS",
  60_000,
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Client IP + quota first: never inspect the body of a rejected request
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

  const rl = rateLimiter.check(clientIpRateLimitKey(ip));
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

  // 2. Enforce content-length limit before body parsing
  const lengthError = checkContentLength(request, MAX_COMPLETE_BODY_SIZE, rlHeaders);
  if (lengthError) return lengthError;

  // 3. Parse JSON body
  const bodyResult = await parseJsonBody(request, MAX_COMPLETE_BODY_SIZE, rlHeaders);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  // 4. Validate body
  const validation = validateCompleteInterviewRequest(bodyResult.data);
  if (!validation.valid) {
    return validationErrorResponse(validation.error, validation.status, rlHeaders);
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
    return handleInterviewApiError(err, {
      routeLabel: "interview/complete",
      fallbackMessage: "Failed to complete technical interview session.",
      headers: rlHeaders,
    });
  }
}

export async function GET(): Promise<NextResponse> {
  return methodNotAllowedResponse(
    "Method Not Allowed. Use POST to complete an interview session.",
  );
}
