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

  // Scan-only rendering and measurement fixes (no source changes):
  //
  // 1. body background-image: none — body carries two radial-gradient layers
  //    (~8.5% and ~3.5% opacity). axe marks every descendant "incomplete" when
  //    any ancestor has background-image. Stripping exposes the solid #070a0d
  //    base so axe can compute contrast ratios.
  //
  // 2. content-visibility: visible — sections below the fold have
  //    content-visibility: auto, which skips their paint subtree entirely.
  //    Without this override off-screen elements are invisible to axe.
  //
  // 3. Named decorative gradient overlays — stripped by class name:
  //    .engineering-grid / .engineering-grid-dense: dot/line grid (~2.5% white)
  //    .noise-overlay: fixed full-page noise texture (position:fixed; inset:0)
  //    .atmosphere: per-section ambient radial glow (position:absolute; inset:0)
  //    display:none is used for fixed/absolute overlays because
  //    background-image:none alone still leaves them in the stacking context.
  //
  // 4. [class*="bg-gradient-"] background-image: none — Tailwind gradient
  //    utilities (bg-gradient-to-t, bg-gradient-to-b, bg-gradient-to-r) are
  //    applied inline in JSX, so they have no named class to target. Axe cannot
  //    resolve contrast when any DOM ancestor carries a gradient; affected nodes
  //    include IdentityCard image scrim (from-black/80), card hover overlays,
  //    and the Experience timeline line (from-emerald-300/60). All are purely
  //    decorative — they add no text/background pair that changes the answer.
  await page.addStyleTag({
    content: `
      body { background-image: none !important; }
      section, footer { content-visibility: visible !important; }
      .engineering-grid,
      .engineering-grid-dense { background-image: none !important; }
      .noise-overlay,
      .atmosphere { display: none !important; }
      [class*="bg-gradient-"] { background-image: none !important; }
    `,
  });
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Documented intentional low-contrast watermarks (aria-hidden decorative):
    // - About "01" numeral: near-invisible background graphic (white/[0.03])
    // - SectionShell vertical index: design sidebar watermark (white/20)
    .exclude(".decorative-watermark")
    // Next.js dev toolbar injected at runtime — not site content, not shipped.
    .exclude("nextjs-portal")
    .analyze();

  // ── STEP 1: group incomplete nodes by axe reason message ──────────────────
  const incompleteNodes = results.incomplete.flatMap((v) =>
    v.nodes.map((n) => ({
      rule: v.id,
      target: n.target.join(" "),
      message: n.any[0]?.message ?? "(no message)",
    })),
  );
  const byReason: Record<string, string[]> = {};
  for (const n of incompleteNodes) (byReason[n.message] ??= []).push(n.target);
  // Attach full JSON so log truncation can never hide a reason group
  test.info().attach("axe-incomplete-by-reason", {
    body: JSON.stringify(byReason, null, 2),
    contentType: "application/json",
  });
  console.log("=== STEP 1: reason groups (counts) ===");
  for (const [msg, targets] of Object.entries(byReason))
    console.log(`  [${targets.length}] ${msg}`);

  // ── PROBE A: document-wide gradient sweep with ancestor cross-reference ────
  // Find EVERY element whose computed background-image is a gradient (after all
  // addStyleTag strips). Cross-reference: is it an ancestor of any incomplete
  // node? If yes, that's the unstripped carrier. If the sweep is empty and
  // incompletes exist, the gradient message must have a different cause.
  const uniqueIncompleteTargets = [
    ...new Set(incompleteNodes.map((n) => n.target)),
  ];
  const probeA = await page.evaluate((incompleteTargets) => {
    let nullCount = 0;
    let errCount = 0;
    // Build ancestor sets for each incomplete node
    const incompleteAncestorSets: Set<Element>[] = incompleteTargets.map(
      (sel) => {
        let el: Element | null = null;
        try {
          el = document.querySelector(sel);
        } catch (e) {
          errCount++;
        }
        if (!el) nullCount++;
        const ancestors = new Set<Element>();
        let node: Element | null = el;
        while (node) {
          ancestors.add(node);
          node = node.parentElement;
        }
        return ancestors;
      },
    );

    const carriers: {
      tagClass: string;
      grad: string;
      ancestorOfIncomplete: boolean;
      ancestorOfTargets: string[];
    }[] = [];

    for (const el of document.querySelectorAll("*")) {
      const bi = getComputedStyle(el).backgroundImage;
      if (!bi || bi === "none" || !/gradient\(/.test(bi)) continue;
      const ancestorOfTargets: string[] = [];
      incompleteAncestorSets.forEach((set, i) => {
        if (set.has(el)) ancestorOfTargets.push(incompleteTargets[i]);
      });
      carriers.push({
        tagClass:
          el.tagName.toLowerCase() +
          "." +
          String((el as HTMLElement).className)
            .trim()
            .split(/\s+/)
            .slice(0, 5)
            .join("."),
        grad: bi.slice(0, 100),
        ancestorOfIncomplete: ancestorOfTargets.length > 0,
        ancestorOfTargets,
      });
    }
    return { carriers, nullCount, errCount, totalTargets: incompleteTargets.length };
  }, uniqueIncompleteTargets);

  test.info().attach("probe-a-gradient-carriers", {
    body: JSON.stringify(probeA, null, 2),
    contentType: "application/json",
  });
  console.log(`=== PROBE A: querySelector resolution: ${probeA.totalTargets - probeA.nullCount}/${probeA.totalTargets} found (${probeA.errCount} syntax errors) ===`);
  console.log(`=== PROBE A: ${probeA.carriers.length} gradient carriers found: ===`);
  for (const c of probeA.carriers) {
    console.log(`  CARRIER: ${c.tagClass} => ${c.grad}`);
  }
  const carrierAncestors = probeA.carriers.filter((c) => c.ancestorOfIncomplete);
  console.log(
    `=== PROBE A: ${carrierAncestors.length} are ancestors of incomplete nodes ===`,
  );

  // Write full probe data directly to disk for 100% fidelity without log truncation
  const fs = await import("fs");
  fs.writeFileSync(
    "probe-data.json",
    JSON.stringify({ byReason, probeA, incompleteCount: incompleteNodes.length }, null, 2),
  );

  // ── PROBE B: analyze twice on the same page, compare gradient-incomplete counts ──
  // If axe caches the pre-strip gradient state, r1 and r2 should differ.
  // If they are equal, the cache theory is dead.
  const countGradientIncomplete = (r: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
    r.incomplete.flatMap((v) => v.nodes).filter((n) =>
      n.any.some((c) => c.message?.includes("background gradient")),
    ).length;

  await page.waitForTimeout(500);
  const results2 = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude(".decorative-watermark")
    .exclude("nextjs-portal")
    .analyze();

  const g1 = countGradientIncomplete(results);
  const g2 = countGradientIncomplete(results2);
  console.log(`=== PROBE B: g1=${g1}, g2=${g2} ===`);
  console.log(
    g1 === g2
      ? "  → Equal: timing/cache theory DEAD. Same state seen both times."
      : `  → Different (g1=${g1} vs g2=${g2}): late-injection timing is real.`,
  );
  test.info().attach("probe-b", {
    body: JSON.stringify({ g1, g2, equal: g1 === g2 }),
    contentType: "application/json",
  });

  // ── STEP 2: per-unique-target forensics (limited to 20 to avoid timeout) ──
  const forensic = await page.evaluate((targets) => {
    const report: unknown[] = [];
    for (const sel of targets.slice(0, 20)) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) { report.push({ sel, found: false }); continue; }
      el.scrollIntoView({ block: "center" });
      const gradientAncestors: string[] = [];
      let node: HTMLElement | null = el;
      while (node) {
        const bi = getComputedStyle(node).backgroundImage;
        if (bi !== "none")
          gradientAncestors.push(
            `${node.tagName}.${String(node.className).slice(0, 80)} => ${bi.slice(0, 80)}`,
          );
        node = node.parentElement;
      }
      const r = el.getBoundingClientRect();
      const chain = new Set<Element>();
      let a: Element | null = el;
      while (a) { chain.add(a); a = a.parentElement; }
      const overlapSuspects = document
        .elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .filter((e) => e !== el && !chain.has(e))
        .map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 80)}`);
      const pseudos: string[] = [];
      for (const p of ["::before", "::after"] as const) {
        const cs = getComputedStyle(el, p);
        if (cs.content !== "none" && cs.backgroundImage !== "none")
          pseudos.push(`${p}: ${cs.backgroundImage.slice(0, 80)}`);
      }
      report.push({ sel, gradientAncestors, overlapSuspects, pseudos });
    }
    return report;
  }, uniqueIncompleteTargets);
  test.info().attach("step2-forensics", {
    body: JSON.stringify(forensic, null, 2),
    contentType: "application/json",
  });
  // ── END DIAGNOSTIC ─────────────────────────────────────────────────────────

  const summary = results.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")}`),
  );

  expect(summary.join("\n")).toBe("");

  // Unmeasured ≠ passing. Green must mean "everything measurable passed
  // AND nothing was skipped". Assert incomplete is empty after all
  // scan-only gradient strips above.
  const incomplete = results.incomplete.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
  );

  expect(incomplete.join("\n")).toBe("");
});