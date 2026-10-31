// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // 60s: accommodates cold Next.js dev-server compilation (15-25s) + scan time
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    // Uses the local next binary directly so the suite works even when a
    // global `npm` shim is unavailable; identical to `npm run start`.
    command: "node node_modules/next/dist/bin/next start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
