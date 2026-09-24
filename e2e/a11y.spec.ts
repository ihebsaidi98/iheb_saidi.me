// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SECTION_IDS = [
  "top",
  "about",
  "projects",
  "stack",
  "experience",
  "education",
  "contact",
];

test("no a11y violations across all sections and footer", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  type ViolationDetail = {
    section: string;
    id: string;
    impact: string | null | undefined;
    description: string;
    target: string;
    html: string;
    failureSummary: string;
  };

  const accumulatedViolations: ViolationDetail[] = [];

  const seenNodes = new Set<string>();

  const runScan = async (contextName: string) => {
    const builder = new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Exclude intentional low-contrast watermarks:
      // 1. About section giant "01" numeral (decorative background graphic)
      // 2. SectionShell vertical section index (decorative sidebar watermark)
      .exclude(".decorative-watermark");

    const results = await builder.analyze();
    for (const v of results.violations) {
      for (const node of v.nodes) {
        const key = `${v.id}::${node.target.join(" > ")}`;
        if (!seenNodes.has(key)) {
          seenNodes.add(key);
          accumulatedViolations.push({
            section: contextName,
            id: v.id,
            impact: v.impact,
            description: v.description,
            target: node.target.join(" "),
            html: node.html,
            failureSummary: node.failureSummary || "",
          });
        }
      }
    }
  };

  for (const id of SECTION_IDS) {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await runScan(`section#${id}`);
  }

  // Scroll to document end and scan the footer
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await runScan("footer");

  const formattedViolations = accumulatedViolations
    .map(
      (v, idx) =>
        `\n[${idx + 1}] [${v.section}] ${v.id} (${v.impact ?? "unknown"}): ${v.description}\n` +
        `    Target: ${v.target}\n` +
        `    HTML: ${v.html}\n` +
        `    Summary: ${v.failureSummary}`
    )
    .join("\n");

  expect(
    accumulatedViolations,
    `Found ${accumulatedViolations.length} accessibility violation(s) across sections:\n${formattedViolations}`
  ).toEqual([]);
});