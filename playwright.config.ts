import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      APP_URL: "http://127.0.0.1:3100",
      DATABASE_PATH: resolve("test-results/e2e.sqlite"),
      SEED_DEMO: "true",
      EMAIL_DELIVERY: process.env.EVENTLY_E2E_EMAIL_DISABLED
        ? "resend"
        : "preview",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      EMAIL_PREVIEW_DIR: resolve("test-results/mail"),
      EVENTLY_TEST_MODE: "true",
      MUSIC_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      SPOTIFY_CLIENT_ID: "fixture-client",
      SPOTIFY_CONNECTION_TEST: "true",
      SPOTIFY_APPROVED_USE_CASE: "false",
      STRIPE_SECRET_KEY: "sk_test_local_fixture_only",
      STRIPE_WEBHOOK_SECRET: "whsec_local_fixture_only",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
