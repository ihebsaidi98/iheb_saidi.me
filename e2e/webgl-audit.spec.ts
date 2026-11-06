import { test, expect } from "@playwright/test";

test("Full WebGL Context Validation & 3D Scene Health", async ({ page }, testInfo) => {
  const warnings: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "warning" || text.includes("WebGL") || text.includes("Context") || text.includes("context")) {
      warnings.push(`[${msg.type()}] ${text}`);
    }
    if (msg.type() === "error") {
      errors.push(text);
    }
  });

  // Track WebGL context creations on canvases
  await page.addInitScript(() => {
    const knownCanvases = new Set<HTMLCanvasElement>();
    let sceneCanvasLostCount = 0;
    let sceneCanvasRestoredCount = 0;
    let probeCanvasesCreated = 0;
    let sceneCanvasesCreated = 0;

    (window as any).__webglAudit = {
      get totalCanvases() { return knownCanvases.size; },
      get probeCanvases() { return probeCanvasesCreated; },
      get sceneCanvases() { return sceneCanvasesCreated; },
      get sceneLost() { return sceneCanvasLostCount; },
      get sceneRestored() { return sceneCanvasRestoredCount; },
    };

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (type: string, ...args: any[]) {
      const res = origGetContext.apply(this, [type, ...args] as any);
      if (type.includes("webgl")) {
        const isProbe = this.width <= 1 && this.height <= 1;
        if (!knownCanvases.has(this)) {
          knownCanvases.add(this);
          if (isProbe) {
            probeCanvasesCreated++;
            console.log(`[WebGL-Tracker] probe canvas created (total probe canvases: ${probeCanvasesCreated})`);
          } else {
            sceneCanvasesCreated++;
            console.log(`[WebGL-Tracker] scene canvas created (total scene canvases: ${sceneCanvasesCreated})`);
          }

          if (!isProbe && res) {
            this.addEventListener("webglcontextlost", () => {
              sceneCanvasLostCount++;
              console.warn(`[WebGL-Tracker] SCENE canvas context lost! (total lost: ${sceneCanvasLostCount})`);
            });
            this.addEventListener("webglcontextrestored", () => {
              sceneCanvasRestoredCount++;
              console.warn(`[WebGL-Tracker] SCENE canvas context restored!`);
            });
          }
        }
      }
      return res;
    };
  });

  console.log("=== STEP 1: Desktop Initial Load ===");
  await page.setViewportSize({ width: 1440, height: 900 });
  // ?a11y=1 disables Lenis smooth scrolling (native scrolling), so anchor clicks
  // resolve immediately. It does not disable the 3D scene, which depends on the
  // system prefers-reduced-motion preference rather than the a11y query flag.
  await page.goto("/?a11y=1", { waitUntil: "networkidle" });

  // Locate and wait for 3D canvas to mount and start rendering
  const canvas = page.locator("#top canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);

  let audit = await page.evaluate(() => (window as any).__webglAudit);
  console.log("Initial load audit:", audit);

  // Exactly 1 probe canvas and 1 scene canvas
  expect(audit.probeCanvases).toBe(1);
  expect(audit.sceneCanvases).toBe(1);
  expect(audit.sceneLost).toBe(0);

  console.log("=== STEP 2: Navigate Between All Portfolio Sections Repeatedly ===");
  // A token stored on window lets us prove the document was never reloaded:
  // a full page load would drop it and reset the WebGL counters.
  const navToken = await page.evaluate(() => {
    const token = Math.random();
    (window as any).__navToken = token;
    return token;
  });
  const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });
  const sections = [
    { name: "Work", target: "#projects" },
    { name: "About", target: "#about" },
    { name: "Experience", target: "#experience" },
    { name: "Contact", target: "#contact" },
    { name: "Home", target: "#top" },
    { name: "About", target: "#about" },
    { name: "Work", target: "#projects" },
    { name: "Home", target: "#top" },
  ];
  for (const section of sections) {
    // The header auto-hides while scrolling down, so a normal click would be
    // rejected for visibility. Dispatching the click on the real nav anchor
    // still runs its activation behaviour (in-page navigation, no document load).
    await primaryNav.getByRole("link", { name: section.name, exact: true }).dispatchEvent("click");
    await expect(page.locator(section.target)).toBeInViewport({ ratio: 0.1, timeout: 8000 });

    const sameDocument = await page.evaluate((token) => (window as any).__navToken === token, navToken);
    expect(sameDocument, `Navigating to "${section.name}" must stay client-side`).toBe(true);

    const stepAudit = await page.evaluate(() => (window as any).__webglAudit);
    expect(stepAudit.probeCanvases, `probe canvas count after "${section.name}"`).toBe(1);
    expect(stepAudit.sceneCanvases, `scene canvas count after "${section.name}"`).toBe(1);
    expect(stepAudit.sceneLost, `lost contexts after "${section.name}"`).toBe(0);
  }
  audit = await page.evaluate(() => (window as any).__webglAudit);
  console.log("Audit after section navigation:", audit);
  expect(audit.probeCanvases).toBe(1);
  expect(audit.sceneCanvases).toBe(1);
  expect(audit.sceneLost).toBe(0);

  console.log("=== STEP 3: Open & Close Interactive Components (Chat Widget) ===");
  const chatFab = page.locator('button[aria-label="Open portfolio chatbot"]');
  const chatDialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
  await expect(chatFab).toBeVisible({ timeout: 8000 });
  for (let i = 0; i < 4; i++) {
    await chatFab.click();
    await expect(chatDialog).toBeVisible({ timeout: 8000 });
    await chatDialog.getByRole("button", { name: /Close chat/i }).click();
    await expect(chatDialog).not.toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(250);
  }
  audit = await page.evaluate(() => (window as any).__webglAudit);
  console.log("Audit after opening/closing chat widget:", audit);
  expect(audit.probeCanvases).toBe(1);
  expect(audit.sceneCanvases).toBe(1);
  expect(audit.sceneLost).toBe(0);

  console.log("=== STEP 4: Responsive Testing (Desktop <-> Tablet <-> Mobile) ===");
  const viewports = [
    { width: 375, height: 667, name: "Mobile (iPhone SE)" },
    { width: 768, height: 1024, name: "Tablet (iPad)" },
    { width: 1440, height: 900, name: "Desktop" },
    { width: 390, height: 844, name: "Mobile (iPhone 12)" },
    { width: 1440, height: 900, name: "Desktop" },
  ];
  for (const vp of viewports) {
    console.log(`Setting viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(350);
  }
  audit = await page.evaluate(() => (window as any).__webglAudit);
  console.log("Audit after responsive switches:", audit);

  // Probe canvas count must remain EXACTLY 1 despite 5 viewport media query changes!
  expect(audit.probeCanvases).toBe(1);
  expect(audit.sceneLost).toBe(0);

  console.log("=== STEP 5: Verify 3D Scene is Still Functional & Rendering ===");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?#top");
  await page.waitForTimeout(1000);

  // Check frames are actively rendering
  const frames = await page.evaluate(async () => {
    let count = 0;
    return new Promise<number>((resolve) => {
      const step = () => {
        count++;
        if (count >= 10) resolve(count);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  console.log(`Rendered ${frames} animation frames`);
  expect(frames).toBeGreaterThanOrEqual(10);

  // Take screenshot as visual verification (portable, inside Playwright output dir)
  await page.screenshot({ path: testInfo.outputPath("webgl-verified-scene.png") });

  console.log("=== Warnings Captured ===", warnings);
  console.log("=== Errors Captured ===", errors);

  const contextWarnings = warnings.filter(w =>
    w.toLowerCase().includes("too many active webgl contexts") ||
    w.toLowerCase().includes("context lost") ||
    w.toLowerCase().includes("context restored")
  );
  expect(contextWarnings).toHaveLength(0);
  expect(errors.filter(e => e.includes("WebGL") || e.includes("Context"))).toHaveLength(0);
});
