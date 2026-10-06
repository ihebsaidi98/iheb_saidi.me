// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // 60s: accommodates cold Next.js dev-server compilation (15-25s) + scan time
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
 // playwright.config.ts
webServer: {
  command: "npm run start",   // was: "npm run dev"
  port: 3000,
  reuseExistingServer: false,
  timeout: 60_000,
},
});
