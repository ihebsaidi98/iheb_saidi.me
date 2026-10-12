/**
 * src/app/api/chat/route.ts
 *
 * POST /api/chat
 *
 * Flow:
 *   1. Rate limit (per IP, in-memory, 10 req/min)
 *   2. Parse + validate request body
 *   3. Sanitise inputs
 *   4. RAG: embed question → retrieve top-K portfolio chunks
 *   5. Build grounded, injection-resistant prompt
 *   6. Call OpenAI Chat Completions (with timeout)
 *   7. Return { reply, sources } — answer grounded in retrieved docs
 *
 * Security invariants:
 *   - OPENAI_API_KEY stays server-side; never sent to the client.
 *   - Retrieved chunks are treated as untrusted; see chat.ts SYSTEM_PROMPT.
 *   - LLM is never given raw PII beyond what is already in public portfolio docs.
 *   - Timeout prevents hanging requests from exhausting function budget.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchPortfolioKnowledge } from "@/lib/rag";
import {
  InMemoryRateLimiter,
  validateChatRequest,
  sanitizeText,
  buildChatMessages,
  formatSources,
  extractClientIp,
  type ChatResponse,
  type ChatErrorResponse,
  type ChatApiMessage,
} from "@/lib/chat";

// ---- Configuration (env vars — all server-side) ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
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
  if (!OPENAI_API_KEY) {
    console.error("[chat/route] OPENAI_API_KEY is not set.");
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

  // 7. Build grounded prompt
  const messages = buildChatMessages(question, chunks, history);

  // 8. Call LLM with timeout
  let reply: string;
  try {
    reply = await callOpenAI(messages, OPENAI_API_KEY, OPENAI_CHAT_MODEL);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[chat/route] LLM request timed out.");
      return NextResponse.json(
        {
          error: "The request timed out. Please try again.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rlHeaders },
      );
    }
    console.error("[chat/route] LLM call failed:", err instanceof Error ? err.message : err);
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

// ============================================================
// LLM CLIENT
// Non-streaming, with AbortController timeout.
// The API key is accepted as a parameter (not captured from closure)
// so the function signature makes the dependency explicit.
// ============================================================

async function callOpenAI(
  messages: ChatApiMessage[],
  apiKey: string,
  model: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // API key is server-side only — never exposed in client bundles.
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,   // Low temperature = factual, grounded
        max_tokens: 600,
        // Instruct the model not to loop on the same phrase
        frequency_penalty: 0.1,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Do NOT include raw OpenAI error text in user-facing responses
    // (it may reveal model identifiers or billing details).
    const status = response.status;
    throw new Error(`OpenAI API returned status ${status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI returned an empty or missing response.");
  }

  return content.trim();
}
