import { defineConfig, devices } from "@playwright/test";

/**
 * Full-stack E2E (#58): runs against a REAL running app + backend (no API
 * mocks), so there is no webServer here — the stack is booted externally
 * (docker-compose.e2e.yml in CI, or your local dev stack). Point it at the app
 * with E2E_BASE_URL.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/fullstack",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
