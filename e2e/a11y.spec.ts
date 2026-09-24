// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("no a11y violations across the full page", async ({ page }) => {
  // Freeze entrance animations at their final state before first paint.
  // The site honours prefers-reduced-motion via MotionConfig reducedMotion='user'
  // and the @media (prefers-reduced-motion: reduce) block in globals.css.
  // Without this, axe can scan mid-animation opacity states (e.g. hero letters
  // at opacity:0), producing nondeterministic violation counts across runs.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Staleness canary: this content was added this session. If it's missing,
  // we are testing a different server — fail loudly.
  await expect(page.locator("#experience")).toContainText("AgroRetail OS");

  // Two rendering fixes applied for the scan only (no source changes):
  //
  // 1. body background-image: none — body carries two radial-gradient layers
  //    on top of the solid #070a0d base. axe cannot resolve contrast through
  //    any gradient ancestor and marks every descendant as "incomplete" (= 0
  //    violations reported). Stripping the gradient exposes the solid base so
  //    axe can calculate ratios correctly. The gradient is purely decorative
  //    and near-transparent; removing it does not change any text/bg pair.
  //
  // 2. content-visibility: visible — below-fold sections have
  //    content-visibility: auto, which skips their paint subtree. Without
  //    this override, off-screen elements are invisible to axe.
  await page.addStyleTag({
    content: `
      body { background-image: none !important; }
      section, footer { content-visibility: visible !important; }
    `,
  });
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Documented intentional low-contrast watermarks (aria-hidden decorative):
    // - About "01" numeral: near-invisible background graphic (white/[0.03])
    // - SectionShell vertical index: design sidebar watermark (white/20)
    .exclude(".decorative-watermark")
    .analyze();

  const summary = results.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")}`),
  );

  expect(summary.join("\n")).toBe("");
});