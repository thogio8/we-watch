/**
 * One app server and one database per Playwright worker, so tests run in
 * parallel without sharing a list. GitHub's runners have 2 cores.
 */
export const E2E_WORKERS = process.env.CI ? 2 : 4;
export const FAKE_TMDB_PORT = 3218;
export const E2E_AUTH_SECRET = "e2e-auth-secret-0123456789abcdef0123";

export const appPort = (worker: number) => 3220 + worker;
export const appUrl = (worker: number) => `http://localhost:${appPort(worker)}`;
export const databaseOf = (worker: number) => `e2e/.data/e2e-${worker}.db`;
export const workerIndexes = () => [...Array(E2E_WORKERS).keys()];

/** Overrides .env.production.local, which `next start` loads otherwise. */
export const e2eEnv = (worker: number) => ({
  DATABASE_URL: `file:${databaseOf(worker)}`,
  DATABASE_AUTH_TOKEN: "",
  TMDB_ACCESS_TOKEN: "fake-token",
  TMDB_API_URL: `http://localhost:${FAKE_TMDB_PORT}/3`,
  CRON_SECRET: "e2e-cron-secret-0123456789",
  BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
  BETTER_AUTH_URL: appUrl(worker),
  // The e2e runs in open mode. Invite mode is covered by the functional tests
  // (tests/functional/invite-signup.test.ts) and SigninScreen's tests.
  SIGNUP: "open",
  // A code is set, so the screens offer « J’AI UN CODE PROPRIÉTAIRE » (the
  // captures show it); without one, the link is hidden (unit tests).
  OWNER_CODE: "e2e-owner-code-0123",
});

/** Chromium's debugging port, where Lighthouse finds it (test:lighthouse). */
export const LIGHTHOUSE_PORT = 9222;
