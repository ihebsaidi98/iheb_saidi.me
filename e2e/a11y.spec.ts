import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type A11yWindow = Window & { __A11Y_READY?: boolean };

type AllowedIncomplete = {
  rule: string;
  target: string;
  reason: string;
};

// Finalized allowlist from the real production output. These selectors are kept
// intentionally conservative because they are either decorative-only, gradient-
// backed, or short non-text letter fragments that axe cannot score reliably.
const ALLOWED_INCOMPLETE: AllowedIncomplete[] = [
  {
    rule: "color-contrast",
    target: ".border-r.text-white\\/70.px-4",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: "a[href$=\"#top\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: "a[href$=\"#about\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".hover\\:text-white\\/90.focus-visible\\:text-white[href$=\"#projects\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: "a[href$=\"#stack\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: "a[href$=\"#experience\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".hover\\:text-white\\/90.focus-visible\\:text-white[href$=\"#contact\"] > .z-10.relative",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".gap-2\\.5.items-center.flex > .text-emerald-200\\/70.tracking-\\[0\\.22em\\].text-\\[9px\\]",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".hero-letter-mask.overflow-hidden.inline-flex:nth-child(1) > .hero-letter:nth-child(1)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".hero-letter-mask.overflow-hidden.inline-flex:nth-child(1) > .hero-letter:nth-child(2)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".hero-letter-mask.overflow-hidden.inline-flex:nth-child(1) > .hero-letter:nth-child(3)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".hero-letter-mask.overflow-hidden.inline-flex:nth-child(1) > .hero-letter:nth-child(4)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".text-transparent.hero-letter:nth-child(1)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".text-transparent.hero-letter:nth-child(2)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".text-transparent.hero-letter:nth-child(3)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".text-transparent.hero-letter:nth-child(4)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".text-transparent.hero-letter:nth-child(5)",
    reason: "too short",
  },
  {
    rule: "color-contrast",
    target: ".sm\\:text-base.mt-4.text-sm",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: "span[aria-hidden=\"true\"] > .text-white\\/85",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".max-w-lg",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".hover\\:-translate-y-0\\.5",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".tracking-\\[0\\.1em\\]",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".tracking-\\[0\\.2em\\].text-\\[10px\\].text-white\\/50:nth-child(1)",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".hover\\:text-white\\/80",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".tracking-\\[0\\.2em\\].text-\\[10px\\].text-white\\/50:nth-child(3)",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".from-black\\/80 > span",
    reason: "background gradient",
  },
  {
    rule: "color-contrast",
    target: ".-top-10",
    reason: "overlapped by another element",
  },
  {
    rule: "color-contrast",
    target: "code > .ml-1.text-emerald-300\\/90[aria-hidden=\"true\"]",
    reason: "non-text characters",
  },
  {
    rule: "color-contrast",
    target: "pre > code",
    reason: "partially overlaps",
  },
  {
    rule: "color-contrast",
    target: ".space-y-4 > div:nth-child(1) > p",
    reason: "partially overlaps",
  },
  {
    rule: "color-contrast",
    target: ".ml-1.text-emerald-300\\/90.font-mono",
    reason: "non-text characters",
  },
  {
    rule: "color-contrast",
    target: ".mr-2",
    reason: "non-text characters",
  },
  {
    rule: "color-contrast",
    target: ".left-4",
    reason: "pseudo element",
  },
  {
    rule: "color-contrast",
    target: ".text-white\\/75",
    reason: "pseudo element",
  },
  {
    rule: "color-contrast",
    target: ".mt-0\\.5.truncate.block",
    reason: "pseudo element",
  },
  {
    rule: "color-contrast",
    target: ".ml-4",
    reason: "pseudo element",
  },
  {
    rule: "color-contrast",
    target: ".mb-5 > .technical-label",
    reason: "overlapped by another element",
  },
];

function normalizeTarget(target: unknown): string {
  if (Array.isArray(target)) {
    return target
      .map((entry) => (typeof entry === "string" ? entry : String(entry)))
      .join(" ");
  }
  return typeof target === "string" ? target : String(target);
}

test("prod accessibility smoke + readiness gate", async ({ page }) => {
  const consoleBuffer: string[] = [];
  page.on("console", (msg) => {
    const entry = `${msg.type()}: ${msg.text()}`;
    consoleBuffer.push(entry);
    if (consoleBuffer.length > 30) consoleBuffer.shift();
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

  try {
    await expect
      .poll(
        () => page.evaluate(() => (window as A11yWindow).__A11Y_READY === true),
        { timeout: 15_000 },
      )
      .toBe(true);
  } catch (error) {
    const snapshot = await page.evaluate(() => ({
      readyState: document.readyState,
      fontsStatus: document.fonts?.status ?? "unknown",
      a11yReady: (window as A11yWindow).__A11Y_READY ?? null,
      url: location.href,
      title: document.title,
    }));

    throw new Error(
      "__A11Y_READY never became true on the production boot.\n" +
        `readyState=${snapshot.readyState}\n` +
        `fontsStatus=${snapshot.fontsStatus}\n` +
        `a11yReady=${String(snapshot.a11yReady)}\n` +
        `lastConsole=${consoleBuffer.slice(-30).join(" | ")}`,
    );
  }

  await expect(page.locator("#experience")).toContainText("AgroRetail OS");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("nextjs-portal")
    .analyze();

  const violations = results.violations.flatMap((v) =>
    v.nodes.map((n) => ({
      rule: v.id,
      impact: v.impact ?? "unknown",
      target: normalizeTarget(n.target),
    })),
  );

  expect(
    violations,
    `Axe violations:\n${violations
      .map((v) => `${v.rule} (${v.impact}): ${v.target}`)
      .join("\n") || "none"}`,
  ).toHaveLength(0);

  const incomplete = results.incomplete.flatMap((v) =>
    v.nodes.map((n) => ({
      rule: v.id,
      target: normalizeTarget(n.target),
      message: n.any[0]?.message ?? n.failureSummary ?? "",
    })),
  );

  const unmatched = incomplete.filter(
    (node) =>
      !ALLOWED_INCOMPLETE.some(
        (entry) =>
          entry.rule === node.rule &&
          entry.target === node.target &&
          node.message.includes(entry.reason),
      ),
  );

  const stale = ALLOWED_INCOMPLETE.filter(
    (entry) =>
      !incomplete.some(
        (node) =>
          entry.rule === node.rule &&
          entry.target === node.target &&
          node.message.includes(entry.reason),
      ),
  );

  if (unmatched.length || stale.length) {
    const diagnostic = JSON.stringify(
      {
        unmatched,
        stale,
        consoleBuffer: consoleBuffer.slice(-30),
      },
      null,
      2,
    );
    test.info().attach("a11y-diagnostics", {
      body: diagnostic,
      contentType: "application/json",
    });
  }

  expect(
    unmatched,
    `Unmatched incomplete nodes:\n${unmatched
      .map((node) => `${node.rule}: ${node.target}: ${node.message}`)
      .join("\n") || "none"}`,
  ).toHaveLength(0);

  expect(
    stale,
    `Stale allowlist entries:\n${stale
      .map((entry) => `${entry.rule}: ${entry.target}`)
      .join("\n") || "none"}`,
  ).toHaveLength(0);

  const heading = page.locator("h1");
  await expect(heading).toHaveAccessibleName(
    "Iheb Saidi, full-stack software engineer",
  );

  const navContrast = await page.locator("header nav").first().evaluate((nav) => {
    const navBg = window.getComputedStyle(nav).backgroundColor || "rgba(8, 13, 18, 0.8)";
    const bodyBg = window.getComputedStyle(document.body).backgroundColor || "rgb(7, 10, 13)";
    const brand = nav.querySelector("span") as HTMLElement | null;
    const textColor = brand ? window.getComputedStyle(brand).color : window.getComputedStyle(nav).color;

    const parseColor = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/i)?.[1];
      if (!match) return null;
      const parts = match.split(",").map((part) => Number.parseFloat(part.trim()));
      if (parts.length < 3) return null;
      const [r, g, b, a = 1] = parts;
      return { r, g, b, a };
    };

    const toLinear = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
      0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    const composite = (
      base: { r: number; g: number; b: number; a: number },
      overlay: { r: number; g: number; b: number; a: number },
    ) => ({
      r: Math.round(base.r * (1 - overlay.a) + overlay.r * overlay.a),
      g: Math.round(base.g * (1 - overlay.a) + overlay.g * overlay.a),
      b: Math.round(base.b * (1 - overlay.a) + overlay.b * overlay.a),
    });

    const navBackground = parseColor(navBg);
    const pageBackground = parseColor(bodyBg);
    const fg = parseColor(textColor);
    if (!navBackground || !pageBackground || !fg) {
      return 0;
    }

    const actualNavBackground = composite(pageBackground, navBackground);
    const compositeText = composite(actualNavBackground, fg);
    const L1 = luminance(actualNavBackground);
    const L2 = luminance(compositeText);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  });

  // The glass header is a translucent dark panel over the app background, so the
  // real worst-case contrast is computed from the composited background and the
  // 70% white nav text. This is comfortably above the 7:1 threshold used for
  // the sticky glass header in the final accessibility pass.
  expect(navContrast, `Glass header contrast ratio: ${navContrast}`).toBeGreaterThan(7.0);
});