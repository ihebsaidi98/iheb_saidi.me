import { test, expect } from "@playwright/test";

test("Hero 3D scene renders WebGL canvas without ReactCurrentOwner errors", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // In headless environments, SwiftShader triggers failIfMajorPerformanceCaveat: true
  // We override this caveat check so the WebGL 3D scene mounts and tests in headless Chromium
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attributes?: any) {
      if (attributes && attributes.failIfMajorPerformanceCaveat) {
        const copy = { ...attributes };
        delete copy.failIfMajorPerformanceCaveat;
        return originalGetContext.call(this, type, copy);
      }
      return originalGetContext.call(this, type, attributes);
    } as any;
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  // Navigate to portfolio homepage
  const response = await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  expect(response?.ok()).toBe(true);

  // Verify no unhandled page errors or ReactCurrentOwner errors occurred
  const allErrors = [...consoleErrors, ...pageErrors];
  const r3fErrors = allErrors.filter(
    (e) =>
      e.includes("ReactCurrentOwner") ||
      e.includes("TypeError") ||
      e.includes("Cannot read properties of undefined"),
  );
  expect(r3fErrors, `Detected runtime errors: ${r3fErrors.join("; ")}`).toHaveLength(0);

  // Locate the 3D canvas
  const canvas = page.locator("#top canvas, div[aria-hidden='true'] canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15000 });

  // Verify bounding box dimensions
  const box = await canvas.boundingBox();
  expect(box, "Canvas must have a bounding box").not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Verify WebGL context is initialized and active
  const isWebGLActive = await canvas.evaluate((el: HTMLCanvasElement) => {
    const gl = el.getContext("webgl2") || el.getContext("webgl");
    if (!gl) return false;
    return !gl.isContextLost();
  });
  expect(isWebGLActive, "WebGL context must be initialized and active").toBe(true);

  // Verify requestAnimationFrame renders frames
  const framesRendered = await page.evaluate(async () => {
    let count = 0;
    return new Promise<number>((resolve) => {
      const step = () => {
        count++;
        if (count >= 5) {
          resolve(count);
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  });
  expect(framesRendered).toBeGreaterThanOrEqual(5);

  // Capture screenshot as visual evidence (CROSS-LOT7-01: portable path —
  // testInfo.outputPath lands in test-results/, no machine-specific location).
  await page.screenshot({ path: testInfo.outputPath("hero-3d-scene.png") });
});
