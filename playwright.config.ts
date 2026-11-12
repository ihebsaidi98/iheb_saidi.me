// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The WebGL audit captures a real canvas and frequently triggers GPU/browser
  // contention when browser workers run in parallel. Keeping the suite serial
  // prevents flaky screenshot timeouts without disabling WebGL or changing app code.
  workers: 1,
  // 60s: accommodates cold Next.js dev-server compilation (15-25s) + scan time
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      args: ["--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    // Start the production app and refuse to reuse an old server on port 3000.
    // Reusing a stale or unrelated Next server causes the browser to request
    // assets from the wrong process, which is exactly the text/plain + 404
    // pattern seen during the Hero E2E failures.
    //
    // CROSS-LOT7-01: `next build` must run exactly once, whether the app is
    // started here or already built by the caller.
    //   - local (`npm run test:e2e` = `playwright test`): this command builds
    //     the app, then starts it, so a plain local run stays self-contained.
    //   - CI (`npm run test:e2e:ci`): the workflow runs `npm run build` once and
    //     sets PLAYWRIGHT_SKIP_BUILD=1, so only `next start` runs here.
    // The flag must be exactly "1": any other value keeps the build.
    command:
      process.env.PLAYWRIGHT_SKIP_BUILD === "1"
        ? "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000"
        : "node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000",
    port: 3000,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
