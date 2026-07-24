import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "cross-env BANDOS_TEST_DATABASE_PATH=data/e2e.db node --import tsx scripts/prepare-test-db.ts && cross-env DATABASE_URL=file:./data/e2e.db BANDOS_EMAIL_TRANSPORT=mock NEXT_TELEMETRY_DISABLED=1 next dev -H 127.0.0.1 -p 3102",
    url: "http://127.0.0.1:3102/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
