/**
 * src/lib/interview-route-helpers.ts
 *
 * Shared helper functions for Interview API proxy routes:
 *   - /api/interview/start
 *   - /api/interview/submit
 *   - /api/interview/complete
 */

import { NextRequest, NextResponse } from "next/server";
import { AIServiceClientError } from "./ai-service-client";

/**
 * 1. Pre-flight Content-Length check before body reading.
 * Returns a 413 NextResponse if Content-Length exceeds max allowed bytes,
 * a 400 NextResponse if Content-Length is malformed/invalid, or null if valid.
 */
export function checkContentLength(
  request: NextRequest,
  maxBodySize: number,
): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) {
    return null;
  }

  const trimmed = contentLength.trim();
  if (!/^\d+$/.test(trimmed)) {
    return NextResponse.json(
      {
        error: "Invalid Content-Length header.",
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed > maxBodySize) {
    return NextResponse.json(
      {
        error: `Payload too large. Maximum allowed size is ${maxBodySize} bytes.`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  return null;
}

export type ParseJsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; response: NextResponse };

/**
 * 2. Reads and parses JSON body safely with payload size verification in UTF-8 bytes.
 * Returns parsed body object or a 413/400 error response.
 */
export async function parseJsonBody(
  request: NextRequest,
  maxBodySize: number,
  headers?: Record<string, string>,
): Promise<ParseJsonBodyResult> {
  try {
    const text = await request.text();
    const byteLength = Buffer.byteLength(text, "utf8");
    if (byteLength > maxBodySize) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: `Payload too large. Maximum allowed size is ${maxBodySize} bytes.`,
            code: "PAYLOAD_TOO_LARGE",
          },
          { status: 413, headers },
        ),
      };
    }
    const data = text ? JSON.parse(text) : {};
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Invalid JSON in request body.",
          code: "BAD_REQUEST",
        },
        { status: 400, headers },
      ),
    };
  }
}

/**
 * 3. Builds a standardized 400/422 validation error response.
 */
export function validationErrorResponse(
  error: string,
  status: 400 | 422,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      error,
      code: "VALIDATION_ERROR",
    },
    { status, headers },
  );
}

export interface HandleInterviewErrorOptions {
  routeLabel: string;
  fallbackMessage: string;
  headers?: Record<string, string>;
}

/**
 * 4. Centralized upstream error handler for AIServiceClientError & unexpected failures.
 * Maps upstream status codes and errors to appropriate client responses without leaking secrets.
 */
export function handleInterviewApiError(
  err: unknown,
  options: HandleInterviewErrorOptions,
): NextResponse {
  const { routeLabel, fallbackMessage, headers } = options;

  if (err instanceof AIServiceClientError) {
    if (err.code === "TOKEN_MISMATCH") {
      const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
      return NextResponse.json(
        {
          error: cleanMessage,
          code: "TOKEN_MISMATCH",
        },
        { status: 403, headers },
      );
    }

    if (err.status === 401 || err.status === 403) {
      console.error(
        `[${routeLabel}] Upstream auth rejected (${err.code}):`,
        err.message,
      );
      return NextResponse.json(
        {
          error:
            "Internal interview service authentication failed. Please contact the site owner.",
          code: "AUTH_ERROR",
        },
        { status: 500, headers },
      );
    }

    if (err.code === "INVALID_RESPONSE") {
      console.error(`[${routeLabel}] Upstream invalid response:`, err.message);
      return NextResponse.json(
        {
          error: "Upstream interview service returned an unexpected response format.",
          code: "UPSTREAM_ERROR",
        },
        { status: 502, headers },
      );
    }

    if (err.isUnavailable || err.status === 503) {
      const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
      return NextResponse.json(
        {
          error: cleanMessage,
          code: err.code || "SERVICE_UNAVAILABLE",
        },
        { status: 503, headers },
      );
    }

    if (err.status && err.status >= 400 && err.status < 500) {
      const cleanMessage = err.message.replace(/^\[AIServiceClient\]\s*/, "");
      return NextResponse.json(
        {
          error: cleanMessage,
          code: err.code || "REQUEST_ERROR",
        },
        { status: err.status, headers },
      );
    }
  }

  console.error(`[${routeLabel}] Unexpected failure:`, err);
  return NextResponse.json(
    {
      error: fallbackMessage,
      code: "INTERVIEW_ERROR",
    },
    { status: 502, headers },
  );
}

/**
 * 5. Standardized 405 Method Not Allowed response for GET requests.
 */
export function methodNotAllowedResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
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
