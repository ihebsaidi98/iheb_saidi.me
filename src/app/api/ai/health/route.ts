import { NextRequest, NextResponse } from "next/server";
import { aiServiceClient } from "@/lib/ai-service-client";
import { clientIpRateLimitKey, extractClientIp } from "@/lib/chat";
import { createRouteRateLimiter } from "@/lib/rate-limit-config";

export const dynamic = "force-dynamic";

// F1: public endpoint that triggers one outbound readiness probe per request.
const { limit: AI_HEALTH_RATE_LIMIT, rateLimiter } = createRouteRateLimiter(
  "AI_HEALTH_RATE_LIMIT",
  60,
  "AI_HEALTH_RATE_WINDOW_MS",
  60_000,
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  let ip: string;
  try {
    ip = extractClientIp(request);
  } catch (err) {
    console.error("[ai/health] Client IP verification failed:", err);
    return NextResponse.json(
      {
        error: "Unable to process request: client IP cannot be verified safely.",
        code: "IP_VERIFICATION_FAILED",
      },
      { status: 500 },
    );
  }

  const rl = rateLimiter.check(clientIpRateLimitKey(ip));

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many health checks. Please wait before retrying.",
        code: "RATE_LIMITED",
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(AI_HEALTH_RATE_LIMIT),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  try {
    const health = await aiServiceClient.checkHealth(3000);
    // Only the readiness verdict is public: `version`, `environment`,
    // `gemini_configured` and the index details describe the deployment.
    return NextResponse.json({
      status: "ok",
      pythonService: { status: health.status },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service unreachable";
    return NextResponse.json(
      {
        status: "unavailable",
        error: "Python AI Service is currently unreachable or offline.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 503 },
    );
  }
}
