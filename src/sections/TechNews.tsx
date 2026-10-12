"use client";

/**
 * src/sections/TechNews.tsx
 *
 * Tech News section — reuses the portfolio design system:
 *   SectionShell, design tokens, framer-motion patterns, typography scale.
 *
 * Features:
 *   - Category filter pills (client-side — no re-fetch)
 *   - Load-more (client-side pagination)
 *   - Loading skeleton (9 cards)
 *   - Error state + retry
 *   - Empty state
 *   - Soft warning when some feeds failed
 *   - "PUBLISHER TEXT" / "DEV COMMUNITY" badge — labels the description source
 *   - External links: target="_blank" rel="noopener noreferrer"
 *   - Responsive: 1 col → 2 col → 3 col
 *   - Keyboard accessible, ARIA labelled
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { SectionShell } from "@/components/ui/SectionShell";
import { CATEGORIES } from "@/lib/tech-news";
import type { NewsArticle, CategoryId, TechNewsApiResponse } from "@/lib/tech-news";

// ============================================================
// CONSTANTS
// ============================================================

const INITIAL_COUNT = 9;
const LOAD_MORE_COUNT = 9;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Colour scheme per category. Stays within the emerald/cyan dark-mode palette. */
const CAT_STYLE: Record<string, { pill: string; badge: string }> = {
  "ai-llm":       { pill: "border-emerald-400/25 bg-emerald-400/8 text-emerald-300",  badge: "text-emerald-400/70" },
  "java-spring":  { pill: "border-cyan-400/25 bg-cyan-400/8 text-cyan-300",           badge: "text-cyan-400/70" },
  "angular-ts":   { pill: "border-rose-400/25 bg-rose-400/8 text-rose-300",           badge: "text-rose-400/70" },
  "backend":      { pill: "border-violet-400/25 bg-violet-400/8 text-violet-300",     badge: "text-violet-400/70" },
  "cloud-devops": { pill: "border-sky-400/25 bg-sky-400/8 text-sky-300",              badge: "text-sky-400/70" },
};

// ============================================================
// DATE FORMATTER (client-side — avoids SSR hydration mismatch)
// ============================================================

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "—";
    return new Intl.DateTimeFormat("en", {
      year: "numeric", month: "short", day: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}

// ============================================================
// SKELETON CARD
// ============================================================

function SkeletonCard() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
        <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-3 w-10 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ============================================================
// ARTICLE CARD
// ============================================================

function ArticleCard({ article, index }: { article: NewsArticle; index: number }) {
  const style = CAT_STYLE[article.category] ?? CAT_STYLE["backend"]!;
  const catLabel = CATEGORIES.find((c) => c.id === article.category)?.label ?? article.category;
  const sourceLabel = article.source === "devto" ? "DEV COMMUNITY" : "PUBLISHER TEXT";

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${article.title} — ${article.publisher}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index * 0.04, 0.28) }}
      className={twMerge(
        "group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5",
        "outline-none transition-all duration-300",
        "hover:border-white/[0.13] hover:bg-white/[0.04]",
        "focus-visible:ring-1 focus-visible:ring-emerald-400/50",
      )}
    >
      {/* Top row: category pill + date */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={twMerge(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium",
            style.pill,
          )}
        >
          {catLabel}
        </span>
        <time
          dateTime={article.publishedAt}
          className="shrink-0 font-mono text-[10px] tabular-nums text-white/30"
        >
          {fmtDate(article.publishedAt)}
        </time>
      </div>

      {/* Title */}
      <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-white/85 transition-colors duration-200 group-hover:text-white">
        {article.title}
      </h3>

      {/* Description */}
      {article.description ? (
        <p className="mt-2 flex-1 line-clamp-3 text-xs leading-relaxed text-white/45">
          {article.description}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {/* Footer: source label + publisher + read link */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={twMerge(
              "font-mono text-[9px] font-semibold tracking-[0.1em]",
              style.badge,
            )}
          >
            {sourceLabel}
          </span>
          <span className="truncate font-mono text-[10px] text-white/35">
            {article.publisher}
          </span>
        </div>
        <span
          aria-hidden
          className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-white/35 transition-colors duration-200 group-hover:text-white/65"
        >
          Read <span>↗</span>
        </span>
      </div>
    </motion.a>
  );
}

// ============================================================
// ERROR STATE
// ============================================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-3xl" aria-hidden>⚡</p>
      <p className="mt-4 text-sm font-medium text-white/60">
        Couldn&apos;t load tech news
      </p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-white/35">
        The news feeds couldn&apos;t be reached right now. Check your connection or try again.
      </p>
      <button
        onClick={onRetry}
        className={twMerge(
          "mt-6 rounded-full border border-white/15 px-5 py-2.5",
          "text-xs font-medium text-white/60 transition-colors",
          "hover:border-white/30 hover:text-white",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({ category }: { category: CategoryId }) {
  const label = CATEGORIES.find((c) => c.id === category)?.label ?? category;
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-3xl" aria-hidden>📭</p>
      <p className="mt-4 text-sm font-medium text-white/55">
        No articles for &ldquo;{label}&rdquo; yet
      </p>
      <p className="mt-1.5 text-xs text-white/30">
        Feeds refresh every 30 minutes — check back soon.
      </p>
    </div>
  );
}

// ============================================================
// CATEGORY PILLS
// ============================================================

function CategoryPills({
  active,
  counts,
  onChange,
}: {
  active: CategoryId;
  counts: Record<string, number>;
  onChange: (id: CategoryId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by category"
      className="flex flex-wrap gap-2"
    >
      {CATEGORIES.map((cat) => {
        const count = cat.id === "all" ? undefined : counts[cat.id];
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(cat.id)}
            className={twMerge(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50",
              isActive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-white/[0.08] text-white/45 hover:border-white/15 hover:text-white/75",
            )}
          >
            {cat.label}
            {count !== undefined && count > 0 && (
              <span
                className={twMerge(
                  "ml-1.5 font-mono text-[9px]",
                  isActive ? "text-emerald-400/60" : "text-white/25",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN SECTION
// ============================================================

export function TechNewsSection() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [feedErrors, setFeedErrors] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [fetchKey, setFetchKey] = useState(0);

  // Fetch from API route (cached server-side)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setStatus("loading");

    fetch("/api/tech-news", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json() as Promise<TechNewsApiResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setArticles(data.articles ?? []);
        setFeedErrors(data.feedErrors ?? {});
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchKey]);

  const handleRetry = useCallback(() => setFetchKey((k) => k + 1), []);

  // Category article counts (for badges on pills)
  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    for (const a of articles) {
      c[a.category] = (c[a.category] ?? 0) + 1;
    }
    return c;
  }, [articles]);

  // Client-side filter
  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? articles
        : articles.filter((a) => a.category === activeCategory),
    [articles, activeCategory],
  );

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleCount;

  const handleCategoryChange = (cat: CategoryId) => {
    setActiveCategory(cat);
    setVisibleCount(INITIAL_COUNT);
  };

  const failedFeedCount = Object.keys(feedErrors).length;

  return (
    <SectionShell
      id="tech-news"
      label="tech news"
      title={["Stay current,", "stay sharp."]}
      intro="Real articles from official engineering blogs and developer communities — covering the technologies Iheb works with. Descriptions are publisher-written, never AI-generated."
    >
      {/* Category pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <CategoryPills
          active={activeCategory}
          counts={counts}
          onChange={handleCategoryChange}
        />
      </motion.div>

      {/* Article area */}
      <div className="mt-8">
        {/* Loading */}
        {status === "loading" && (
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading articles"
          >
            {Array.from({ length: INITIAL_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {status === "error" && <ErrorState onRetry={handleRetry} />}

        {/* Success */}
        {status === "success" && (
          <>
            {/* Empty */}
            {visible.length === 0 && (
              <EmptyState category={activeCategory} />
            )}

            {/* Cards */}
            {visible.length > 0 && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  role="feed"
                  aria-label="Tech news articles"
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  {visible.map((article, i) => (
                    <ArticleCard key={article.id} article={article} index={i} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleCount((v) => v + LOAD_MORE_COUNT)}
                  className={twMerge(
                    "group inline-flex items-center gap-2 rounded-full border border-white/15",
                    "px-6 py-3 text-xs font-medium text-white/55 transition-all duration-300",
                    "hover:border-white/28 hover:text-white",
                  )}
                >
                  Load more
                  <span className="font-mono text-[10px] text-white/30 transition-colors group-hover:text-white/55">
                    ({remaining} remaining)
                  </span>
                </button>
              </div>
            )}

            {/* Feed-error soft notice */}
            {failedFeedCount > 0 && (
              <p className="mt-8 text-center font-mono text-[10px] text-white/25">
                {failedFeedCount} feed{failedFeedCount > 1 ? "s" : ""} temporarily unavailable — showing articles from remaining sources.
              </p>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}
