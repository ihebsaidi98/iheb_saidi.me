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
import {
  InMemoryRateLimiter,
  validateChatRequest,
  sanitizeText,
  buildGeminiChatPayload,
  extractGeminiResponseText,
  formatSources,
  extractClientIp,
  type ChatResponse,
  type ChatErrorResponse,
  type GeminiChatPayload,
} from "@/lib/chat";

// ---- Configuration (env vars — all server-side) ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite";
const CHAT_RATE_LIMIT = parseInt(process.env.CHAT_RATE_LIMIT ?? "10", 10);
const CHAT_RATE_WINDOW_MS = parseInt(
  process.env.CHAT_RATE_WINDOW_MS ?? "60000",
  10,
);
const LLM_TIMEOUT_MS = 15_000;
const RAG_TOP_K = 5;

// Module-level singleton — persists across requests in the same process.
const rateLimiter = new InMemoryRateLimiter(CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
rateLimiter.startAutoCleanup();

// ============================================================
// POST /api/chat
// ============================================================

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatResponse | ChatErrorResponse>> {
  // 1. Rate limit
  const ip = extractClientIp(request);
  const rl = rateLimiter.check(ip);

  const rlHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(CHAT_RATE_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many requests. Please wait a moment before sending another message.",
        code: "RATE_LIMITED",
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

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  // 3. Validate
  const validated = validateChatRequest(body);
  if (!validated.valid) {
    return NextResponse.json(
      { error: validated.error, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  // 4. Sanitise
  const question = sanitizeText(validated.message);
  const history = validated.history.map((m) => ({
    role: m.role,
    content: sanitizeText(m.content),
  }));

  // 5. Guard: API key must exist before any external call
  if (!GEMINI_API_KEY) {
    console.error("[chat/route] GEMINI_API_KEY is not set.");
    return NextResponse.json(
      {
        error: "The chat service is not configured. Please contact the site owner.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503 },
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

  // 7. Build grounded Gemini payload
  const payload = buildGeminiChatPayload(question, chunks, history);

  // 8. Call Gemini with timeout
  let reply: string;
  try {
    reply = await callGemini(payload, GEMINI_API_KEY, GEMINI_CHAT_MODEL);
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
    const safeError = redactSecrets(
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

  // 9. Format sources and return
  const sources = formatSources(chunks);

  return NextResponse.json(
    { reply, sources },
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

function redactSecrets(msg: string): string {
  return msg
    .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
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
  if (
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("INVALID_ARGUMENT")
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

        const safeErrMsg = redactSecrets(
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
