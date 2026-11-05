/**
 * src/app/api/tech-news/route.ts
 *
 * GET /api/tech-news
 *
 * Returns cached tech-news articles aggregated from public RSS feeds
 * and the DEV.to public API. API keys stay server-side.
 *
 * Caching strategy:
 *   - `export const revalidate = 1800` → Next.js ISR revalidates every 30 min
 *   - Module-level `cache` entry → same-instance requests skip re-fetching
 *   - Module-level `inFlight` promise → concurrent misses share one refresh
 *
 * M2-01: the endpoint stays public but is rate limited per client IP, so a
 * caller cannot use it to amplify outbound feed requests. The quota is applied
 * before the cache lookup and before any external call.
 *
 * M2-05: the freshness check and the cache write are separated by an `await`,
 * so without deduplication every concurrent miss would fan out to all feeds.
 * `inFlight` collapses them onto a single refresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { type TechNewsApiResponse } from "@/lib/tech-news";
import { getFeedSource } from "@/lib/tech-news-feed-source";
import { clientIpRateLimitKey, extractClientIp } from "@/lib/chat";
import { createRouteRateLimiter } from "@/lib/rate-limit-config";

export const revalidate = 1800; // 30 minutes

type CacheEntry = { data: TechNewsApiResponse; ts: number };
const CACHE_TTL_MS = 30 * 60 * 1_000;
let cache: CacheEntry | null = null;

/** The refresh currently in progress, shared by every concurrent caller. */
let inFlight: Promise<TechNewsApiResponse> | null = null;

// Module-level singleton — persists across requests in the same process.
const { limit: TECH_NEWS_RATE_LIMIT, rateLimiter } = createRouteRateLimiter(
  "TECH_NEWS_RATE_LIMIT",
  30,
  "TECH_NEWS_RATE_WINDOW_MS",
  60_000,
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Client IP + quota, before the cache lookup and any external call.
  let ip: string;
  try {
    ip = extractClientIp(request);
  } catch (err) {
    console.error("[tech-news/route] Client IP verification failed:", err);
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
    "X-RateLimit-Limit": String(TECH_NEWS_RATE_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many news requests. Please wait before fetching the feed again.",
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

  // 2. Cached payload (unchanged behaviour).
  const now = Date.now();

  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cache.data, cached: true },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" } },
    );
  }

  // 3. Refresh, deduplicated across concurrent callers.
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }

  try {
    const response = await inFlight;
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[tech-news/route] fetchAllFeeds threw:", err);
    // Return stale cache if available rather than an error
    if (cache) {
      return NextResponse.json(
        { ...cache.data, cached: true },
        { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" } },
      );
    }
    return NextResponse.json(
      { articles: [], fetchedAt: new Date().toISOString(), feedErrors: { global: "Failed to fetch news." }, cached: false },
      { status: 502 },
    );
  }
}

/**
 * Fetch every feed once and publish the result to the module cache.
 *
 * The cache timestamp is taken when the refresh completes, not when the first
 * caller arrived, so a slow refresh does not shorten the effective TTL.
 */
async function refresh(): Promise<TechNewsApiResponse> {
  const { articles, feedErrors } = await getFeedSource()(process.env.DEV_TO_API_KEY);

  const response: TechNewsApiResponse = {
    articles,
    fetchedAt: new Date().toISOString(),
    feedErrors,
    cached: false,
  };

  cache = { data: response, ts: Date.now() };
  return response;
}

// Only GET is handled
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "GET" } },
  );
}
