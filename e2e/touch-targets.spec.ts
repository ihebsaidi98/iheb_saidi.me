import { test, expect } from "@playwright/test";

/**
 * Regression tests for WCAG 2.2 target size (2.5.8) on the
 * Professional Experience tab buttons and prev/next controls.
 *
 * The experience selector previously used `py-2` (~30px tall) buttons
 * squeezed into a single row next to the prev/next arrows, which at a
 * 320px viewport produced sub-44px targets and tight column widths.
 * The selector is now a 3-column grid below `sm`, and every control
 * carries an explicit 44px minimum height / width.
 */

const MIN_TARGET = 44;

type TargetReport = {
  label: string;
  width: number;
  height: number;
};

async function measureTabTargets(page: import("@playwright/test").Page) {
  return page.evaluate((): TargetReport[] => {
    const group = document.querySelector('[role="group"][aria-label="Choose experience"]');

    if (!group) return [];

    return Array.from(group.querySelectorAll("button")).map((button, index) => {
      const rect = button.getBoundingClientRect();
      return {
        label: `tab-${index}`,
        width: rect.width,
        height: rect.height,
      };
    });
  });
}

test.describe("Professional experience touch targets", () => {
  test("tab buttons meet 44x44 at 320px viewport with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    // Scroll the deck into view so layout is final
    await page.locator('[aria-label="Professional experience"]').scrollIntoViewIfNeeded();

    const targets = await measureTabTargets(page);
    expect(targets).toHaveLength(6);

    for (const target of targets) {
      expect(
        target.height,
        `${target.label} height ${target.height}px must be >= ${MIN_TARGET}px`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(
        target.width,
        `${target.label} width ${target.width}px must be >= ${MIN_TARGET}px`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
    }

    // No horizontal overflow introduced by the grid
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });

  test("prev/next arrows meet 44x44 at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    await page.locator('[aria-label="Professional experience"]').scrollIntoViewIfNeeded();

    for (const label of ["Previous experience", "Next experience"]) {
      const box = await page.getByRole("button", { name: label }).boundingBox();
      expect(box, `${label} button should have a bounding box`).not.toBeNull();
      expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });

  test("tab targets hold at desktop width and keyboard operation still switches panels", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    await page.locator('[aria-label="Professional experience"]').scrollIntoViewIfNeeded();

    const targets = await measureTabTargets(page);
    expect(targets).toHaveLength(6);

    for (const target of targets) {
      expect(target.height).toBeGreaterThanOrEqual(MIN_TARGET);
    }

    // Keyboard: focus the group container and advance with ArrowRight
    const region = page.locator('[aria-label="Professional experience"]');
    await region.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("status").filter({ hasText: "Experience 2 of 6" })).toBeVisible();

    // Clicking a tab also switches the panel
    await page.getByRole("button", { name: /Go to Tunisair/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Tunisair" })).toBeVisible();
  });
});
