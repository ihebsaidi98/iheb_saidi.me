// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type Allowed = {
  rule: string;
  targetPrefix: string;
  reasonIncludes: string;
  reason: string;
};

// Intentionally-unmeasurable incomplete nodes. Asserted in BOTH directions:
// every incomplete node must match an entry, and every entry must still match
// at least one node (rot detector — stale entries fail the run).
const ALLOWED_INCOMPLETE: Allowed[] = [
  { rule: "color-contrast", targetPrefix: ".ml-1.text-emerald-300\\/90.font-mono",
    reasonIncludes: "non-text characters", reason: "decorative glyph (↳)" },
  { rule: "color-contrast", targetPrefix: ".mr-2",
    reasonIncludes: "non-text characters", reason: "decorative glyph (●)" },
  { rule: "color-contrast", targetPrefix: 'code > .ml-1.text-emerald-300\\/90[aria-hidden="true"]',
    reasonIncludes: "non-text characters", reason: "decorative glyph (↳), explicitly aria-hidden" },
  { rule: "color-contrast", targetPrefix: 'article[aria-label="Medical Sample Management"]',
    reasonIncludes: "too short to determine", reason: "tag content is literally 'AI'; same-class siblings measure 8.79:1" },
];

test("no a11y violations across the full page", async ({ page }) => {
  // Freeze entrance animations at final state — otherwise axe can scan
  // mid-animation opacity (hero letters at 0) → nondeterministic counts.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Staleness canary — fails loudly if we're testing a different server.
  await expect(page.locator("#experience")).toContainText("AgroRetail OS");

  // ── scan-only measurement overrides — none of this ships to prod ─────────
  // axe resolves contrast through the paint-order stack, which includes
  // non-ancestor siblings. Stripped carriers:
  //  - body's two radial-gradient layers → solid #070a0d base
  //  - content-visibility:auto skips below-fold paint subtrees
  //  - [class*="bg-gradient-"]: Tailwind gradient utilities (inline JSX)
  //  - [class*="bg-[radial-gradient"]: arbitrary-value utility, invisible to
  //    the substring match above (hero corner glow)
  //  - [style*=gradient]: SectionShell underlays (4×) + IdentityCard glow —
  //    inline styles, absolute SIBLINGS behind every text node in their
  //    sections; unreachable by class selectors. Removed layers are
  //    ≤0.9%-alpha white / ≤0.1-alpha emerald → measured bg reads ~1% darker
  //    (slightly optimistic near glow center). Decorative; direction
  //    documented; immaterial at current color choices.
  //  - named decorative layers: grids, noise, atmosphere, ambient-glow
  //  - .case-thumb img: hidden so the span over it measures against the card
  //    surface (its gradient scrim is stripped above)
  //  - four named ::before decorative gradients
  // Hero letters: clip gradient stripped above leaves color:transparent →
  // meaningless 1:1. Pin the WORST stop of emerald-300→sky-400 (#38bdf8,
  // 9.26:1). Worst stop passing ⇒ gradient passing.
  await page.addStyleTag({
    content: `
      body { background-image: none !important; }
      section, footer { content-visibility: visible !important; }
      [class*="bg-gradient-"] { background-image: none !important; }
      [class*="bg-[radial-gradient"] { background-image: none !important; }
      [style*="background-image"],
      [style*="linear-gradient"],
      [style*="radial-gradient"] { background-image: none !important; }
      .engineering-grid,
      .engineering-grid-dense { background-image: none !important; }
      .noise-overlay,
      .atmosphere,
      .ambient-glow { display: none !important; }
      .case-thumb img { visibility: hidden !important; }
      .left-4::before,
      .ml-4::before,
      .mt-0\\.5.truncate.block::before,
      .text-white\\/75::before { content: none !important; }
      .hero-letter { color: #38bdf8 !important; }
    `,
  });
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Documented intentional low-contrast watermarks (aria-hidden decorative).
    .exclude(".decorative-watermark")
    // Next.js dev toolbar — runtime-injected, not shipped.
    .exclude("nextjs-portal")
    .analyze();

  // ── assertion 1: zero violations ─────────────────────────────────────────
  const violations = results.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")}`),
  );
  expect(violations.join("\n")).toBe("");

  // ── assertion 2: every incomplete node allowlisted, no stale entries ─────
  const incomplete = results.incomplete.flatMap((v) =>
    v.nodes.map((n) => ({
      rule: v.id,
      target: n.target.join(" "),
      message: n.any[0]?.message ?? "",
    })),
  );
  const matches = (a: Allowed, n: { rule: string; target: string; message: string }) =>
    n.rule === a.rule &&
    n.target.startsWith(a.targetPrefix) &&
    n.message.includes(a.reasonIncludes);
  const unmatched = incomplete.filter((n) => !ALLOWED_INCOMPLETE.some((a) => matches(a, n)));
  const stale = ALLOWED_INCOMPLETE.filter((a) => !incomplete.some((n) => matches(a, n)));

  if (unmatched.length || stale.length) {
    test.info().attach("a11y-failure", {
      body: JSON.stringify({ unmatched, staleAllowlist: stale }, null, 2),
      contentType: "application/json",
    });
  }
  expect(unmatched.map((n) => `${n.rule}: ${n.target}`).join("\n")).toBe("");
  expect(stale.map((a) => `${a.rule}: ${a.targetPrefix}`).join("\n")).toBe("");
});