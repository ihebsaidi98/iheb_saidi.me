import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashString,
  isValidArticleUrl,
  stripHtml,
  truncateDescription,
  parseDateSafe,
  parseRssItems,
  parseAtomEntries,
  parseDevToResponse,
  CATEGORIES,
} from "./tech-news";

describe("tech-news utility tests", () => {
  it("generates consistent base-36 hashes for strings", () => {
    const h1 = hashString("https://example.com/article-1");
    const h2 = hashString("https://example.com/article-1");
    const h3 = hashString("https://example.com/article-2");
    assert.equal(typeof h1, "string");
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
  });

  it("validates article URLs securely", () => {
    assert.equal(isValidArticleUrl("https://spring.io/blog/2026/01/post"), true);
    assert.equal(isValidArticleUrl("https://dev.to/user/story-123"), true);
    assert.equal(isValidArticleUrl("http://insecure.com/post"), false);
    assert.equal(isValidArticleUrl("javascript:alert(1)"), false);
    assert.equal(isValidArticleUrl(""), false);
    assert.equal(isValidArticleUrl("https://a"), false);
  });

  it("strips HTML tags and entities properly", () => {
    const html = "<p>Hello <strong>World</strong>! &amp; welcome &lt;here&gt;.</p><script>alert(1)</script>";
    const stripped = stripHtml(html);
    assert.equal(stripped, "Hello World! & welcome <here>.");
  });

  it("truncates descriptions safely", () => {
    const long = "<p>" + "A".repeat(300) + "</p>";
    const truncated = truncateDescription(long, 50);
    assert.equal(truncated.length, 51); // 50 chars + ellipsis '…'
    assert.ok(truncated.endsWith("…"));

    const short = "Short text.";
    assert.equal(truncateDescription(short, 50), "Short text.");
  });

  it("parses dates safely or falls back to epoch", () => {
    const valid = parseDateSafe("2026-03-15T12:00:00Z");
    assert.equal(valid, "2026-03-15T12:00:00.000Z");

    const rfc2822 = parseDateSafe("Sun, 15 Mar 2026 12:00:00 GMT");
    assert.equal(rfc2822, "2026-03-15T12:00:00.000Z");

    const invalid = parseDateSafe("invalid-date-string");
    assert.equal(invalid, new Date(0).toISOString());

    const empty = parseDateSafe("");
    assert.equal(empty, new Date(0).toISOString());
  });

  it("parses RSS 2.0 items properly", () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title><![CDATA[Spring Boot 3.4 Released]]></title>
      <link>https://spring.io/blog/spring-boot-3-4</link>
      <pubDate>Mon, 01 Jan 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Spring Boot 3.4 is here with new features.</p>]]></description>
    </item>
    <item>
      <title>Invalid Link Item</title>
      <link>not-a-valid-url</link>
      <pubDate>Tue, 02 Jan 2026 10:00:00 GMT</pubDate>
      <description>Bad item</description>
    </item>
  </channel>
</rss>`;

    const feed = {
      id: "spring",
      name: "Spring Blog",
      url: "https://spring.io/feed",
      category: "java-spring" as const,
      type: "rss" as const,
    };

    const items = parseRssItems(rssXml, feed);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Spring Boot 3.4 Released");
    assert.equal(items[0].url, "https://spring.io/blog/spring-boot-3-4");
    assert.equal(items[0].publisher, "Spring Blog");
    assert.equal(items[0].category, "java-spring");
    assert.equal(items[0].isAiSummary, false);
    assert.equal(items[0].source, "rss");
    assert.ok(items[0].description.includes("Spring Boot 3.4 is here"));
  });

  it("parses Atom entries properly", () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Martin Fowler</title>
  <entry>
    <title>Patterns of Distributed Systems</title>
    <link rel="alternate" href="https://martinfowler.com/articles/patterns.html"/>
    <published>2026-02-10T08:00:00Z</published>
    <summary>Deep dive into distributed architectures.</summary>
  </entry>
</feed>`;

    const feed = {
      id: "mf",
      name: "Martin Fowler",
      url: "https://martinfowler.com/feed.atom",
      category: "backend" as const,
      type: "atom" as const,
    };

    const entries = parseAtomEntries(atomXml, feed);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "Patterns of Distributed Systems");
    assert.equal(entries[0].url, "https://martinfowler.com/articles/patterns.html");
    assert.equal(entries[0].category, "backend");
    assert.equal(entries[0].isAiSummary, false);
  });

  it("parses DEV.to responses properly", () => {
    const rawData = [
      {
        id: 101,
        title: "Understanding Angular Signals",
        url: "https://dev.to/author/signals-guide",
        description: "A comprehensive look at reactivity in Angular.",
        published_at: "2026-02-20T14:30:00Z",
        user: { name: "Jane Dev", username: "janedev" },
        organization: { name: "Angular Community" },
      },
      {
        id: 102,
        title: "Invalid Article Without URL",
        url: "invalid-url",
        description: "No url",
        published_at: "2026-02-21T14:30:00Z",
        user: { name: "Jane", username: "jane" },
      },
    ];

    const feed = {
      id: "devto-angular",
      name: "DEV Community",
      url: "https://dev.to/api/articles?tag=angular",
      category: "angular-ts" as const,
      type: "devto" as const,
    };

    const articles = parseDevToResponse(rawData, feed);
    assert.equal(articles.length, 1);
    assert.equal(articles[0].title, "Understanding Angular Signals");
    assert.equal(articles[0].publisher, "Angular Community");
    assert.equal(articles[0].category, "angular-ts");
    assert.equal(articles[0].isAiSummary, false);
    assert.equal(articles[0].source, "devto");
  });

  it("defines all required categories", () => {
    const ids = CATEGORIES.map((c) => c.id);
    assert.ok(ids.includes("all"));
    assert.ok(ids.includes("ai-llm"));
    assert.ok(ids.includes("java-spring"));
    assert.ok(ids.includes("angular-ts"));
    assert.ok(ids.includes("backend"));
    assert.ok(ids.includes("cloud-devops"));
  });
});
