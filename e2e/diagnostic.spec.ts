// One-off production-paint inventory for the Step A readiness baseline.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

type A11yWindow = Window & { __A11Y_READY?: boolean };

test("production-paint incomplete inventory", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });
  await expect.poll(
    () => page.evaluate(() => (window as A11yWindow).__A11Y_READY === true),
    { timeout: 15_000 },
  ).toBe(true);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("nextjs-portal")
    .analyze();

  const enrich = (result: typeof results.violations[number]) => ({
    rule: result.id,
    impact: result.impact,
    nodes: result.nodes.map((node) => ({
      target: node.target,
      message: node.any[0]?.message ?? node.failureSummary ?? "",
      html: node.html.slice(0, 300),
    })),
  });

  fs.writeFileSync(
    "e2e/baseline-report.json",
    JSON.stringify(
      {
        violations: results.violations.map(enrich),
        incomplete: results.incomplete.map(enrich),
      },
      null,
      2,
    ),
  );
});
