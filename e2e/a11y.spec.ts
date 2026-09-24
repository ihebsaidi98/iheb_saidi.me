// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type Allowed = {
  rule: string;
  // Sed-stable match tokens: every token must appear in the axe target string.
  // Never match on full serialized selectors — axe re-serializes targets when
  // sibling classes change, and opacity fixes rewrite class strings mid-harness.
  targetTokens: string[];
  reasonIncludes: string;
  reason: string;
};

// Intentionally-unmeasurable incomplete nodes. Asserted in BOTH directions:
// every incomplete node must match an entry, and every entry must still match
// at least one node (rot detector — stale entries fail the run).
// Deleted since 976d708: the Medical "AI" tooShort entry — absent from the
// incomplete set in both drift-probe scans under the current strips.
const ALLOWED_INCOMPLETE: Allowed[] = [
  { rule: "color-contrast", targetTokens: ["ml-1", "emerald-300"],
    reasonIncludes: "non-text characters",
    reason: "decorative prompt/arrow glyphs (↳); one instance explicitly aria-hidden" },
  { rule: "color-contrast", targetTokens: ["mr-2"],
    reasonIncludes: "non-text characters",
    reason: "decorative status glyph (●)" },
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
  //  - [class*="bg-gradient-"] / [class*="bg-[radial-gradient"]: Tailwind
  //    gradient utilities incl. arbitrary values (hero readability overlays)
  //  - [style*=gradient]: SectionShell underlays (4×) + IdentityCard glow —
  //    inline styles, absolute SIBLINGS behind every text node in their
  //    sections; unreachable by class selectors. Removed layers are
  //    ≤0.9%-alpha white / ≤0.1-alpha emerald → measured bg reads ~1% darker
  //    (slightly optimistic near glow center). Decorative; direction
  //    documented; immaterial at current color choices.
  //  - named decorative layers: grids, noise, atmosphere, ambient-glow
  //  - display:none (NOT visibility:hidden — hidden elements keep their
  //    layout rect and can still trip axe's overlap detection) for solid
  //    decorative coverers named by the drift-probe census:
  //      · the four SectionShell opacity-[0.35] grid underlays
  //      · .decorative-watermark ("01" numeral) — also excluded below
  //      · img.blur-sm — decorative blurred card-background images
  //      · bg-black/20 + bg-white/[0.025] card overlays
  //      · bg-emerald-400/[0.05] hero-fallback glow blob
  //      · case-thumb + group/card images — scrim spans measure against the
  //        card surface (the old scrim descendant selector matched zero
  //        elements: the portrait img is a sibling, not a descendant)
  //      · bg-emerald-300/40 1px underline accents
  //  - [class*="bg-[#04070c]"] transparent: the hero-fallback base div and
  //    section#top — text measures against body #070a0d (lighter →
  //    conservative). Cross-boot drift was traced to fallback boots.
  //  - .case-thumb::after + .row-sweep::before: decorative pseudos on
  //    ANCESTORS (scanline sweep / hover sweep).
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
      .decorative-watermark { display: none !important; }
      [class*="opacity-[0.35]"] { display: none !important; }
      img.blur-sm { display: none !important; }
      [class*="bg-black/20"] { display: none !important; }
      [class*="bg-white/[0.025]"] { display: none !important; }
      [class*="bg-emerald-400/[0.05]"] { display: none !important; }
      .case-thumb img,
      [class*="group/card"] img { display: none !important; }
      [class*="bg-emerald-300/40"] { display: none !important; }
      [class*="bg-[#04070c]"] { background-color: transparent !important; }
      .case-thumb::after { content: none !important; }
      .row-sweep::before { content: none !important; }
      .left-4::before,
      .ml-4::before,
      .mt-0\\.5.truncate.block::before,
      .text-white\\/75::before { content: none !important; }
      .hero-letter { color: #38bdf8 !important; }
    `,
  });

  // Settle wait: the drift probe showed the incomplete set is stable within
  // a boot after 3s (two scans, identical nodes and world state). Cross-boot
  // variance comes from WebGL-fallback boots, handled by the strips above.
  await page.waitForTimeout(3000);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Documented intentional near-invisible numeral (also display:none above).
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
    a.targetTokens.every((t) => n.target.includes(t)) &&
    n.message.includes(a.reasonIncludes);
  const unmatched = incomplete.filter((n) => !ALLOWED_INCOMPLETE.some((a) => matches(a, n)));
  const stale = ALLOWED_INCOMPLETE.filter((a) => !incomplete.some((n) => matches(a, n)));

  if (unmatched.length || stale.length) {
    // Boot fingerprint: cross-boot drift was traced to WebGL-fallback boots.
    const boot = await page.evaluate(() => ({
      canvases: document.querySelectorAll("canvas").length,
      imgsLoaded: [...document.querySelectorAll("img")].filter(
        (i) => i.complete && i.naturalWidth > 0,
      ).length,
      imgsTotal: document.querySelectorAll("img").length,
    }));
    test.info().attach("a11y-failure", {
      body: JSON.stringify({ boot, unmatched, staleAllowlist: stale }, null, 2),
      contentType: "application/json",
    });
  }
  expect(unmatched.map((n) => `${n.rule}: ${n.target}`).join("\n")).toBe("");
  expect(stale.map((a) => `${a.rule}: ${a.targetTokens.join("+")}`).join("\n")).toBe("");
});