/**
 * src/lib/tech-news-feed-source.ts
 *
 * Indirection over `fetchAllFeeds` for the tech-news route.
 *
 * Per-feed failures are absorbed by `Promise.allSettled` inside
 * `fetchAllFeeds`, so an aggregator-level rejection is the only way to reach
 * the route's stale-cache / 502 fallback. This module lets tests simulate that
 * rejection without patching a frozen ESM namespace.
 */

import { fetchAllFeeds } from "./tech-news";

let current: typeof fetchAllFeeds = fetchAllFeeds;

export function getFeedSource(): typeof fetchAllFeeds {
  return current;
}

export function setFeedSource(fn: typeof fetchAllFeeds): void {
  current = fn;
}
