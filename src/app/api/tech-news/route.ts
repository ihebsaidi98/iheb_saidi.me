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
 *   - Module-level `cache` Map → same-instance requests skip re-fetching
 */

import { NextResponse } from "next/server";
import { fetchAllFeeds, type TechNewsApiResponse } from "@/lib/tech-news";

export const revalidate = 1800; // 30 minutes

type CacheEntry = { data: TechNewsApiResponse; ts: number };
const CACHE_TTL_MS = 30 * 60 * 1_000;
let cache: CacheEntry | null = null;

export async function GET(): Promise<NextResponse<TechNewsApiResponse>> {
  const now = Date.now();

  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cache.data, cached: true },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" } },
    );
  }

  const devToApiKey = process.env.DEV_TO_API_KEY;

  let articles;
  let feedErrors: Record<string, string> = {};

  try {
    ({ articles, feedErrors } = await fetchAllFeeds(devToApiKey));
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

  const response: TechNewsApiResponse = {
    articles,
    fetchedAt: new Date().toISOString(),
    feedErrors,
    cached: false,
  };

  cache = { data: response, ts: now };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" },
  });
}

// Only GET is handled
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "GET" } },
  );
}
