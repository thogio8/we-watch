import { defineConfig, devices } from "@playwright/test";
import { LIGHTHOUSE_PORT } from "./e2e/env";
import base from "./playwright.config";

/**
 * Lighthouse on the screens (e2e/lighthouse/): `npm run test:lighthouse`,
 * inside the same Docker image as the e2e. One worker, so one server and
 * one database (worker 0's), and one Chromium that Lighthouse reaches on its
 * debugging port.
 */
export default defineConfig({
  ...base,
  testDir: "e2e/lighthouse",
  testIgnore: [],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  projects: [
    {
      name: "lighthouse",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: [`--remote-debugging-port=${LIGHTHOUSE_PORT}`] },
      },
    },
  ],
  webServer: Array.isArray(base.webServer)
    ? base.webServer.slice(0, 1)
    : base.webServer,
});
