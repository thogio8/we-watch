import { defineConfig, devices } from "@playwright/test";
import { appPort, appUrl, E2E_WORKERS, e2eEnv, workerIndexes } from "./e2e/env";

/**
 * End-to-end tests: the production build, served on throwaway SQLite files
 * and a fake TMDB (e2e/global-setup.ts). `npm run test:e2e` builds first.
 * Each worker has its own server and database (e2e/env.ts, e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: E2E_WORKERS,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    // Per-pixel colour tolerance absorbs antialiasing; beyond 10 differing
    // pixels the screen has changed (a recoloured word is hundreds).
    toHaveScreenshot: { maxDiffPixels: 10, animations: "disabled" },
  },
  use: {
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
    {
      // Safari's engine, the iPhone's. Passkey tests need Chromium's virtual
      // authenticator (CDP); the reference captures stay Chromium's only.
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"] },
      grepInvert: /@passkey/,
      testIgnore: /visual\.spec\.ts/,
    },
  ],
  webServer: workerIndexes().map((worker) => ({
    command: `next start --port ${appPort(worker)}`,
    // A public asset: answers 200 without a session.
    url: `${appUrl(worker)}/manifest.webmanifest`,
    env: e2eEnv(worker),
    reuseExistingServer: !process.env.CI,
    stdout: "ignore" as const,
  })),
});
