/**
 * src/lib/tech-news.ts
 *
 * Types, feed configuration, and pure data-transformation utilities
 * for the Tech News section. Fetching happens in the API route only,
 * so no secrets are ever exposed to the client bundle.
 *
 * No HTML is ever fabricated. All titles/publishers/dates/URLs come
 * verbatim from RSS feeds or the DEV.to public JSON API.
 */

// ============================================================
// CATEGORIES
// ============================================================

export type CategoryId =
  | "all"
  | "ai-llm"
  | "java-spring"
  | "angular-ts"
  | "backend"
  | "cloud-devops";

export const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: "all", label: "All" },
  { id: "ai-llm", label: "AI & LLMs" },
  { id: "java-spring", label: "Java / Spring" },
  { id: "angular-ts", label: "Angular / TS" },
  { id: "backend", label: "Backend" },
  { id: "cloud-devops", label: "Cloud & DevOps" },
];

// ============================================================
// TYPES
// ============================================================

export type NewsArticle = {
  /** Stable hash of the article URL — used for deduplication. */
  id: string;
  title: string;
  url: string;
  /** Name of the originating publisher or feed. Never fabricated. */
  publisher: string;
  /** ISO 8601 string from the feed's own pubDate / published field. */
  publishedAt: string;
  /** Plain-text excerpt from the publisher's own description. Never AI-generated. */
  description: string;
  category: Exclude<CategoryId, "all">;
  /**
   * Always false — descriptions in this implementation come directly
   * from the publisher feed, never from an AI model.
   * Kept as a discriminated field so future AI-summary variants can
   * be labelled and distinguished in the UI.
   */
  isAiSummary: false;
  source: "devto" | "rss";
};

export type TechNewsApiResponse = {
  articles: NewsArticle[];
  fetchedAt: string;
  /** Feed IDs whose fetch failed — other feeds still populate results. */
  feedErrors: Record<string, string>;
  cached: boolean;
};

// ============================================================
// FEED CONFIGURATION
// All URLs are public RSS/Atom feeds or the free DEV.to public API.
// No ToS-violating scraping. No paywalled content.
// ============================================================

type FeedType = "devto" | "atom" | "rss";

type FeedConfig = {
  id: string;
  name: string;
  /** Fully qualified URL — RSS/Atom feed or DEV.to API endpoint. */
  url: string;
  category: Exclude<CategoryId, "all">;
  type: FeedType;
};

const DEVTO = (tag: string, n = 8): string =>
  `https://dev.to/api/articles?tag=${tag}&per_page=${n}&top=30`;

export const FEEDS: ReadonlyArray<FeedConfig> = [
  // --- AI & LLMs ---
  { id: "devto-ai", name: "DEV Community", url: DEVTO("artificial-intelligence", 8), category: "ai-llm", type: "devto" },
  { id: "devto-llm", name: "DEV Community", url: DEVTO("llm", 6), category: "ai-llm", type: "devto" },
  { id: "devto-mlops", name: "DEV Community", url: DEVTO("machinelearning", 5), category: "ai-llm", type: "devto" },

  // --- Java / Spring ---
  { id: "spring-blog", name: "Spring.io Blog", url: "https://spring.io/blog.atom", category: "java-spring", type: "atom" },
  { id: "devto-java", name: "DEV Community", url: DEVTO("java", 8), category: "java-spring", type: "devto" },
  { id: "devto-spring", name: "DEV Community", url: DEVTO("spring", 6), category: "java-spring", type: "devto" },

  // --- Angular / TypeScript ---
  { id: "ts-blog", name: "TypeScript Blog", url: "https://devblogs.microsoft.com/typescript/feed/", category: "angular-ts", type: "rss" },
  { id: "devto-angular", name: "DEV Community", url: DEVTO("angular", 8), category: "angular-ts", type: "devto" },
  { id: "devto-typescript", name: "DEV Community", url: DEVTO("typescript", 6), category: "angular-ts", type: "devto" },

  // --- Backend ---
  { id: "martin-fowler", name: "Martin Fowler", url: "https://martinfowler.com/feed.atom", category: "backend", type: "atom" },
  { id: "devto-backend", name: "DEV Community", url: DEVTO("backend", 8), category: "backend", type: "devto" },
  { id: "devto-api", name: "DEV Community", url: DEVTO("api", 5), category: "backend", type: "devto" },

  // --- Cloud / DevOps / Security ---
  { id: "kubernetes-blog", name: "Kubernetes Blog", url: "https://kubernetes.io/feed.xml", category: "cloud-devops", type: "rss" },
  { id: "devto-devops", name: "DEV Community", url: DEVTO("devops", 8), category: "cloud-devops", type: "devto" },
  { id: "devto-security", name: "DEV Community", url: DEVTO("security", 6), category: "cloud-devops", type: "devto" },
];

// ============================================================
// HELPERS — pure, no side effects
// ============================================================

/** djb2 hash → base-36 string. Used as stable article IDs. */
export function hashString(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Reject any URL that is not a reachable, safe HTTPS link. */
export function isValidArticleUrl(url: string): boolean {
  if (!url || url.length < 12 || url.length > 2000) return false;
  try {
    const p = new URL(url);
    return p.protocol === "https:" && p.hostname.includes(".") && p.hostname.length > 3;
  } catch {
    return false;
  }
}

/** Strip HTML tags and decode common entities for safe plain-text use. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?:;])/g, "$1")
    .trim();
}

/** Strip HTML then truncate to `max` chars with ellipsis. */
export function truncateDescription(raw: string, max = 180): string {
  const clean = stripHtml(raw);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + "…";
}

/** Unwrap CDATA if present, otherwise return raw content. */
function unwrapCdata(raw: string): string {
  const m = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? (m[1] ?? "") : raw;
}

/** Extract text content of the first matching tag (optionally with CDATA). */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? unwrapCdata(m[1]?.trim() ?? "") : "";
}

/** Parse an RSS or HTTP date string into a valid ISO 8601 string. */
export function parseDateSafe(raw: string): string {
  if (!raw) return new Date(0).toISOString();
  try {
    const d = new Date(raw.trim());
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

// ============================================================
// RSS 2.0 PARSER
// ============================================================

function extractRssLink(itemXml: string): string {
  // Text content of <link> (standard RSS 2.0)
  const textLink = itemXml.match(/<link[^>]*>\s*(https?:\/\/[^\s<"]+)\s*<\/link>/i)?.[1];
  if (textLink) return textLink.trim();

  // <link rel="alternate" href="..."> (Atom-namespace in RSS)
  const altHref =
    itemXml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)?.[1] ??
    itemXml.match(/<link[^>]+href="([^"]+)"[^>]+rel="alternate"/i)?.[1];
  if (altHref) return altHref.trim();

  // <guid isPermaLink="true"> as fallback
  const guidLink = itemXml.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/i)?.[1];
  if (guidLink) return guidLink.trim();

  // <guid> that looks like a URL
  const guid = itemXml.match(/<guid[^>]*>([^<]+)<\/guid>/i)?.[1]?.trim() ?? "";
  if (guid.startsWith("https://")) return guid;

  return "";
}

export function parseRssItems(xml: string, feed: FeedConfig, max = 10): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null && articles.length < max) {
    const item = m[1] ?? "";
    const title = stripHtml(extractTag(item, "title")).trim();
    const url = extractRssLink(item);
    if (!title || !isValidArticleUrl(url)) continue;

    const desc = truncateDescription(
      extractTag(item, "description") || extractTag(item, "content:encoded"),
    );
    const publishedAt = parseDateSafe(
      extractTag(item, "pubDate") || extractTag(item, "dc:date"),
    );

    articles.push({
      id: hashString(url),
      title,
      url,
      publisher: feed.name,
      publishedAt,
      description: desc,
      category: feed.category,
      isAiSummary: false,
      source: "rss",
    });
  }

  return articles;
}

// ============================================================
// ATOM PARSER
// ============================================================

function extractAtomLink(entryXml: string): string {
  return (
    entryXml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)?.[1] ??
    entryXml.match(/<link[^>]+href="([^"]+)"[^>]+rel="alternate"/i)?.[1] ??
    entryXml.match(/<link[^>]+href="([^"]+)"/i)?.[1] ??
    ""
  ).trim();
}

export function parseAtomEntries(xml: string, feed: FeedConfig, max = 10): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(xml)) !== null && articles.length < max) {
    const entry = m[1] ?? "";
    const title = stripHtml(extractTag(entry, "title")).trim();
    const url = extractAtomLink(entry);
    if (!title || !isValidArticleUrl(url)) continue;

    const desc = truncateDescription(
      extractTag(entry, "summary") || extractTag(entry, "content"),
    );
    const publishedAt = parseDateSafe(
      extractTag(entry, "published") || extractTag(entry, "updated"),
    );

    articles.push({
      id: hashString(url),
      title,
      url,
      publisher: feed.name,
      publishedAt,
      description: desc,
      category: feed.category,
      isAiSummary: false,
      source: "rss",
    });
  }

  return articles;
}

// ============================================================
// DEV.TO API PARSER
// ============================================================

type DevToArticle = {
  id: number;
  title: string;
  url: string;
  description: string;
  published_at: string;
  user: { name: string; username: string };
  organization?: { name: string } | null;
};

export function parseDevToResponse(
  data: unknown,
  feed: FeedConfig,
): NewsArticle[] {
  if (!Array.isArray(data)) return [];

  return (data as DevToArticle[])
    .filter(
      (a) =>
        typeof a?.title === "string" &&
        typeof a?.url === "string" &&
        isValidArticleUrl(a.url),
    )
    .map((a) => ({
      id: hashString(a.url),
      title: a.title.trim(),
      url: a.url,
      publisher: a.organization?.name ?? a.user?.name ?? "DEV Community",
      publishedAt: parseDateSafe(a.published_at),
      description: truncateDescription(a.description ?? ""),
      category: feed.category,
      isAiSummary: false as const,
      source: "devto" as const,
    }));
}

// ============================================================
// MAIN FETCH EXPORT (called from API route only)
// ============================================================

const FETCH_TIMEOUT_MS = 7_000;

const RSS_HEADERS: HeadersInit = {
  "User-Agent": "TechNewsFeedAggregator/1.0 (+https://iheb-saidi.dev; RSS reader)",
  "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
};

const DEVTO_BASE_HEADERS: HeadersInit = {
  "Accept": "application/json",
  "User-Agent": "TechNewsFeedAggregator/1.0",
};

export async function fetchAllFeeds(
  devToApiKey?: string,
): Promise<{ articles: NewsArticle[]; feedErrors: Record<string, string> }> {
  const feedErrors: Record<string, string> = {};
  const allArticles: NewsArticle[] = [];

  const promises = FEEDS.map(async (feed) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      let articles: NewsArticle[];

      if (feed.type === "devto") {
        const headers: HeadersInit = { ...DEVTO_BASE_HEADERS };
        if (devToApiKey) (headers as Record<string, string>)["api-key"] = devToApiKey;
        const res = await fetch(feed.url, { signal: controller.signal, headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        articles = parseDevToResponse(await res.json(), feed);
      } else {
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: RSS_HEADERS,
          // Next.js fetch caching: revalidate every 30 min
          next: { revalidate: 1800 },
        } as RequestInit);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        articles =
          feed.type === "atom"
            ? parseAtomEntries(xml, feed)
            : parseRssItems(xml, feed);
      }

      return { feedId: feed.id, articles };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw { feedId: feed.id, error: msg };
    } finally {
      clearTimeout(timer);
    }
  });

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value.articles);
    } else {
      const reason = result.reason as { feedId?: string; error?: string };
      if (reason?.feedId) feedErrors[reason.feedId] = reason.error ?? "unknown error";
    }
  }

  // Deduplicate by URL hash — first occurrence wins
  const seen = new Set<string>();
  const deduped = allArticles.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort newest-first (epoch 0 dates sort last)
  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return { articles: deduped, feedErrors };
}
