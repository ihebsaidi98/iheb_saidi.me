/**
 * src/app/api/chat/route.ts
 *
 * POST /api/chat
 *
 * Flow:
 *   1. Rate limit (per IP, in-memory, 10 req/min)
 *   2. Parse + validate request body
 *   3. Sanitise inputs
 *   4. RAG: embed question → retrieve top-K portfolio chunks from precomputed index
 *   5. Build grounded, injection-resistant prompt payload for Google Gemini
 *   6. Call Google Gemini (@google/genai) with timeout
 *   7. Return { reply, sources } — answer grounded in retrieved docs
 *
 * Security invariants:
 *   - GEMINI_API_KEY stays server-side; never sent to the client.
 *   - Retrieved chunks are treated as untrusted; see chat.ts SYSTEM_PROMPT.
 *   - LLM is never given raw PII beyond what is already in public portfolio docs.
 *   - Timeout prevents hanging requests from exhausting function budget.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { searchPortfolioKnowledge } from "@/lib/rag";
import { createRouteRateLimiter } from "@/lib/rate-limit-config";
import { sanitizeLogMessage } from "@/lib/redact";
import { checkContentLength } from "@/lib/interview-route-helpers";
import { readBodyWithLimit } from "@/lib/request-body";
import { rejectCrossOriginRequest } from "@/lib/request-origin";
import {
  MAX_CHAT_BODY_SIZE,
  validateChatRequest,
  sanitizeText,
  buildGeminiChatPayload,
  extractGeminiResponseText,
  cleanChatResponse,
  isGreeting,
  GREETING_RESPONSE,
  INSUFFICIENT_EVIDENCE_REPLY,
  clientIpRateLimitKey,
  extractClientIp,
  type ChatResponse,
  type ChatErrorResponse,
  type GeminiChatPayload,
} from "@/lib/chat";

// ---- Configuration (env vars — all server-side) ----
const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS ?? "45000", 10);
const RAG_TOP_K = 5;

// Module-level singleton — persists across requests in the same process.
const { limit: CHAT_RATE_LIMIT, rateLimiter } = createRouteRateLimiter(
  "CHAT_RATE_LIMIT",
  10,
  "CHAT_RATE_WINDOW_MS",
  60_000,
);

// ============================================================
// POST /api/chat
// ============================================================

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatResponse | ChatErrorResponse>> {
  // 0. AUD-12: a browser request initiated by another origin is refused before
  //    the quota is consumed, so a hostile page cannot exhaust a visitor's
  //    budget. Clients that send no browser metadata (curl, server) still pass.
  const originError = rejectCrossOriginRequest(request);
  if (originError) {
    return originError as NextResponse<ChatErrorResponse>;
  }

  // 1. Rate limit
  let ip: string;
  try {
    ip = extractClientIp(request);
  } catch (err) {
    console.error("[chat/route] Client IP verification failed:", err);
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
    "X-RateLimit-Limit": String(CHAT_RATE_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    const rateLimitedBody: ChatErrorResponse & { retryAfterMs: number } = {
      error:
        "Too many requests. Please wait a moment before sending another message.",
      code: "RATE_LIMITED",
      retryAfterMs: rl.retryAfterMs,
    };

    return NextResponse.json(
      rateLimitedBody,
      {
        status: 429,
        headers: {
          ...rlHeaders,
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  // 2. Bound the body before parsing it (AUD-02): `request.json()` buffers the
  //    whole payload first, so the declared Content-Length is checked cheaply
  //    and the bytes actually streamed are counted as they arrive.
  const lengthError = checkContentLength(request, MAX_CHAT_BODY_SIZE, rlHeaders);
  if (lengthError) {
    // `checkContentLength` is shared with the interview routes and returns an
    // untyped body; its payload is `{ error, code }`, which is exactly the
    // chat error shape.
    return lengthError as NextResponse<ChatErrorResponse>;
  }

  const bodyResult = await readBodyWithLimit(request, MAX_CHAT_BODY_SIZE);
  if (bodyResult.tooLarge) {
    return NextResponse.json(
      {
        error: `Payload too large. Maximum allowed size is ${MAX_CHAT_BODY_SIZE} bytes.`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413, headers: rlHeaders },
    );
  }

  let body: unknown;
  try {
    // Same contract as `request.json()`: an empty or malformed body throws and
    // is reported as INVALID_JSON below.
    body = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400, headers: rlHeaders },
    );
  }

  // 3. Validate
  const validated = validateChatRequest(body);
  if (!validated.valid) {
    return NextResponse.json(
      { error: validated.error, code: "INVALID_REQUEST" },
      { status: 400, headers: rlHeaders },
    );
  }

  // 4. Sanitise
  const question = sanitizeText(validated.message);
  const history = validated.history.map((m) => ({
    role: m.role,
    content: sanitizeText(m.content),
  }));

  // 4b. Pure greetings short-circuit (avoid unnecessary RAG retrieval and LLM call)
  if (isGreeting(question)) {
    return NextResponse.json(
      { reply: GREETING_RESPONSE },
      { status: 200, headers: rlHeaders },
    );
  }

  // 5. Guard: API key must exist before any external call
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[chat/route] GEMINI_API_KEY is not set.");
    return NextResponse.json(
      {
        error: "The chat service is not configured. Please contact the site owner.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: rlHeaders },
    );
  }

  // 6. RAG retrieval — retrieve the most relevant portfolio chunks
  let chunks;
  try {
    const ragResult = await searchPortfolioKnowledge(question, {
      limit: RAG_TOP_K,
    });
    chunks = ragResult.results;
  } catch (err) {
    console.error("[chat/route] RAG retrieval failed:", err);
    return NextResponse.json(
      {
        error: "Failed to retrieve portfolio context. Please try again.",
        code: "RETRIEVAL_ERROR",
      },
      { status: 502, headers: rlHeaders },
    );
  }

  // 6b. Abstain if no portfolio chunks met the relevance threshold and no conversation history exists
  if (chunks.length === 0 && history.length === 0) {
    return NextResponse.json(
      { reply: INSUFFICIENT_EVIDENCE_REPLY },
      { status: 200, headers: rlHeaders },
    );
  }

  // 7. Build grounded Gemini payload
  const payload = buildGeminiChatPayload(question, chunks, history);

  // 8. Call Gemini with timeout
  let reply: string;
  try {
    const rawReply = await callGemini(payload, apiKey, GEMINI_CHAT_MODEL);
    reply = cleanChatResponse(rawReply);
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" ||
        err.message.toLowerCase().includes("aborted") ||
        err.message.toLowerCase().includes("timed out"));

    if (isTimeout) {
      console.error("[chat/route] LLM request timed out.");
      return NextResponse.json(
        {
          error: "The request timed out. Please try again.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rlHeaders },
      );
    }
    const safeError = sanitizeLogMessage(
      err instanceof Error ? err.message : String(err),
    );
    console.error("[chat/route] LLM call failed:", safeError);
    return NextResponse.json(
      {
        error: "Failed to generate a response. Please try again.",
        code: "LLM_ERROR",
      },
      { status: 502, headers: rlHeaders },
    );
  }

  // 9. Return response (sources removed from client payload per Phase 1)
  return NextResponse.json(
    { reply },
    { status: 200, headers: rlHeaders },
  );
}

// Only POST is handled
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

function isRetryableModelError(err: unknown): boolean {
  if (
    err instanceof Error &&
    (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"))
  ) {
    return false;
  }
  const status =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status?: number }).status
      : undefined;

  // Permanent client errors: bad request, invalid API key, permission denied
  if (status === 400 || status === 401 || status === 403) {
    return false;
  }

  const rawMsg = err instanceof Error ? err.message : String(err);

  // Catch permanent errors from message string when SDK doesn't set status
  if (
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("API key not valid") ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("INVALID_ARGUMENT") ||
    rawMsg.includes("400 Bad Request") ||
    rawMsg.includes("401 Unauthorized") ||
    rawMsg.includes("403 Forbidden")
  ) {
    return false;
  }

  // Retryable errors: model not found/retired (404), rate limit (429), server overloaded (503), internal error (500)
  if (status === 404 || status === 429 || status === 500 || status === 503) {
    return true;
  }

  return (
    rawMsg.includes("404") ||
    rawMsg.includes("NOT_FOUND") ||
    rawMsg.includes("is no longer available") ||
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.includes("503") ||
    rawMsg.includes("UNAVAILABLE") ||
    rawMsg.includes("high demand") ||
    rawMsg.includes("500") ||
    rawMsg.includes("INTERNAL")
  );
}

// ============================================================
// GEMINI CLIENT
// Non-streaming, with AbortController timeout.
// The API key is accepted as a parameter (not captured from closure)
// so the function signature makes the dependency explicit.
// ============================================================

async function callGemini(
  payload: GeminiChatPayload,
  apiKey: string,
  model: string,
  options: { client?: GoogleGenAI; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? LLM_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const ai = options.client ?? new GoogleGenAI({ apiKey });

  try {
    const runGeneration = async (targetModel: string) => {
      return ai.models.generateContent({
        model: targetModel,
        contents: payload.contents,
        config: {
          systemInstruction: payload.systemInstruction,
          temperature: 0.1, // Low temperature = factual, grounded
          maxOutputTokens: 600,
          abortSignal: controller.signal,
        },
      });
    };

    const candidates = [
      model,
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError: unknown;
    for (const candidate of candidates) {
      if (controller.signal.aborted) {
        const abortErr = new Error("Request timed out");
        abortErr.name = "AbortError";
        throw abortErr;
      }

      try {
        const response = await runGeneration(candidate);
        if (candidate !== model) {
          console.warn(`[chat/route] Fallback to ${candidate} succeeded`);
        }
        return extractGeminiResponseText(response);
      } catch (err) {
        lastError = err;
        if (controller.signal.aborted) {
          const abortErr = new Error("Request timed out");
          abortErr.name = "AbortError";
          throw abortErr;
        }

        if (!isRetryableModelError(err)) {
          throw err;
        }

        const safeErrMsg = sanitizeLogMessage(
          err instanceof Error ? err.message : String(err),
        );
        console.warn(
          `[chat/route] Model ${candidate} unavailable or overloaded (${safeErrMsg}), attempting next fallback...`,
        );
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timer);
  }
}
