// e2e/oracle-probe.spec.ts — THROWAWAY diagnostic. Never commit. Delete after use.
// Axe-as-oracle: my census model of axe's overlap rule failed twice (all
// census-named coverers display:none — "overlapped" persists). So axe itself
// becomes the instrument: for each stubborn node, hide ONE intersecting
// element at a time and re-run axe scoped to the node. Whatever hide flips
// the node to measurable IS the blocker, per axe, not per my model.
// Plus: caret blink monitor (drift hypothesis) + hit-test stack for pre>code.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const TARGETS = [
  ".text-white\\/75",
  ".mt-0\\.5.truncate.block",
  ".ml-4",
  "pre > code",
];

const STRIPS = `
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
`;

test("oracle probe", async ({ page }) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#experience")).toContainText("AgroRetail OS");
  await page.addStyleTag({ content: STRIPS });
  await page.waitForTimeout(3000);

  // ── caret blink monitor (before any mutation) ──────────────────────────
  // Hypothesis: the terminal caret (bg-emerald-300/90, NO hero-caret class →
  // the reduced-motion killswitch does not apply) blinks; scan-time phase
  // decides whether pre>code reads as "overlapped". Three samples over 2s:
  // if opacity toggles, blinking is confirmed.
  const caretSample = () =>
    page.evaluate(() => {
      const span = document.querySelector('[class*="bg-emerald-300/90"]');
      if (!span) return null;
      const cs = getComputedStyle(span);
      const code = document.querySelector("pre > code");
      const cr = code ? code.getBoundingClientRect() : null;
      const sr = span.getBoundingClientRect();
      return {
        classes: String((span as HTMLElement).className).slice(0, 90),
        opacity: cs.opacity,
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        transitionDuration: cs.transitionDuration,
        rect: { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) },
        intersectsCode: cr
          ? !(sr.right < cr.left || sr.left > cr.right || sr.bottom < cr.top || sr.top > cr.bottom)
          : null,
      };
    });
  const caret1 = await caretSample();
  await page.waitForTimeout(1000);
  const caret2 = await caretSample();
  await page.waitForTimeout(1000);
  const caret3 = await caretSample();

  // ── hit-test stack at pre>code center (in-viewport only; hero at top) ──
  const codeStack = await page.evaluate(() => {
    const el = document.querySelector("pre > code");
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight)
      return { found: true, inViewport: false };
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return {
      found: true,
      inViewport: true,
      stack: document
        .elementsFromPoint(cx, cy)
        .map((e) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).slice(0, 70)}`),
    };
  });

  // ── axe-as-oracle bisection ────────────────────────────────────────────
  const scopedIncomplete = async (sel: string) => {
    const r = await new AxeBuilder({ page })
      .include(sel)
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    return r.incomplete
      .filter((v) => v.id === "color-contrast")
      .flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
  };

  const collect = (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const all = [...document.querySelectorAll("*")];
      const out: unknown[] = [];
      let idx = 0;
      for (const e of all) {
        if (e === el || e.contains(el)) continue;
        const b = e.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        const ix = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        const iy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (ix <= 0 || iy <= 0) continue;
        e.setAttribute("data-oracle-idx", String(idx));
        const cs = getComputedStyle(e);
        const pseudo = ["::before", "::after"].filter((p) => {
          const pc = getComputedStyle(e, p);
          return pc.content !== "none" && (pc.backgroundImage !== "none" || pc.backgroundColor !== "rgba(0, 0, 0, 0)");
        });
        out.push({
          idx,
          el: `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String((e as HTMLElement).className).slice(0, 80)}`,
          afterTarget: !!(e.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING),
          pos: cs.position, z: cs.zIndex, pe: cs.pointerEvents,
          bg: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? null : cs.backgroundColor,
          bgImage: cs.backgroundImage === "none" ? null : cs.backgroundImage.slice(0, 60),
          opacity: cs.opacity === "1" ? null : cs.opacity,
          border: cs.borderTopWidth !== "0px" ? `${cs.borderTopWidth} ${cs.borderTopColor}` : null,
          boxShadow: cs.boxShadow === "none" ? null : cs.boxShadow.slice(0, 60),
          filter: cs.filter === "none" ? null : cs.filter.slice(0, 40),
          backdropFilter: cs.backdropFilter && cs.backdropFilter !== "none" ? String(cs.backdropFilter).slice(0, 40) : null,
          transform: cs.transform === "none" ? null : cs.transform.slice(0, 40),
          pseudo: pseudo.length ? pseudo : null,
          overlapPx: Math.round(Math.min(ix, iy)),
        });
        idx++;
      }
      return out;
    }, sel);

  const hide = (i: number, on: boolean) =>
    page.evaluate(({ idx, display }) => {
      const el = document.querySelector(`[data-oracle-idx="${idx}"]`);
      if (el) (el as HTMLElement).style.display = display ? "none" : "";
    }, { idx: i, display: on });

  const report: unknown[] = [];
  for (const t of TARGETS) {
    const baseline = await scopedIncomplete(t);
    const candidates = (await collect(t)) as Record<string, unknown>[] | null;
    if (!candidates) { report.push({ target: t, found: false }); continue; }

    // Prioritise axe-plausible candidates (any visible bg/pseudo/shadow),
    // then by overlap size. NO exclusion filter — the unfiltered dump is the
    // point: my filter was the bug.
    const ranked = [...candidates].sort((a, b) => {
      const vis = (c: Record<string, unknown>) =>
        c.bg || c.bgImage || c.opacity || c.pseudo || c.boxShadow || c.backdropFilter ? 0 : 1;
      return vis(a) - vis(b) || Number(b.overlapPx) - Number(a.overlapPx);
    }).slice(0, 14);

    const trials: unknown[] = [];
    for (const c of ranked) {
      await hide(Number(c.idx), true);
      const after = await scopedIncomplete(t);
      await hide(Number(c.idx), false);
      trials.push({
        hidden: c.el, idx: c.idx,
        resolved: after.length < baseline.length,
        remainingCount: after.length,
      });
    }
    report.push({
      target: t,
      baselineCount: baseline.length,
      baseline: baseline.slice(0, 6),
      candidatesTotal: candidates.length,
      candidates: candidates.slice(0, 30),
      trials,
    });
  }

  const fs = await import("fs");
  fs.writeFileSync(
    "/tmp/oracle-probe.json",
    JSON.stringify({ caret: [caret1, caret2, caret3], codeStack, report }, null, 1),
  );
  console.log(
    `oracle probe: caret opacity=[${caret1?.opacity ?? "n/a"},${caret2?.opacity ?? "n/a"},${caret3?.opacity ?? "n/a"}] -> /tmp/oracle-probe.json`,
  );
});
