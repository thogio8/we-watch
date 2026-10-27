import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/env";

/**
 * End-to-end tests: the production build, served on a throwaway SQLite file
 * and a fake TMDB (e2e/global-setup.ts). `npm run test:e2e` builds first.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One database for every test: run them one after the other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    // Same Linux font rendering locally and on CI: a tiny tolerance absorbs
    // antialiasing, a layout change moves far more pixels.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" },
  },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `next start --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/unlock`,
    env: E2E_ENV,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
