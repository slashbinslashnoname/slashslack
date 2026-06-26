import { defineConfig } from "@playwright/test";

/**
 * End-to-end test. Builds the app and boots the real server (single container
 * style) against a throwaway SQLite DB, then drives a browser.
 *
 * Run:  npm run test:e2e   (first time: npx playwright install chromium)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3010" },
  webServer: {
    command: "npm run build && node server/dist/index.js",
    url: "http://localhost:3010/api/health",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: "3010",
      DATA_DIR: "./e2e/.data",
      UPLOAD_DIR: "./e2e/.uploads",
      SESSION_SECRET: "e2e-secret-key-0123456789-abcdefghij",
    },
  },
});
