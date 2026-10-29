/**
 * One app server and one database per Playwright worker, so tests run in
 * parallel without sharing a list. GitHub's runners have 2 cores.
 */
export const E2E_WORKERS = process.env.CI ? 2 : 4;
export const FAKE_TMDB_PORT = 3218;
export const ACCESS_CODE = "e2e pop corn ce soir";

export const appPort = (worker: number) => 3220 + worker;
export const databaseOf = (worker: number) => `e2e/.data/e2e-${worker}.db`;
export const workerIndexes = () => [...Array(E2E_WORKERS).keys()];

/** Overrides .env.production.local, which `next start` loads otherwise. */
export const e2eEnv = (worker: number) => ({
  DATABASE_URL: `file:${databaseOf(worker)}`,
  DATABASE_AUTH_TOKEN: "",
  TMDB_ACCESS_TOKEN: "fake-token",
  TMDB_API_URL: `http://localhost:${FAKE_TMDB_PORT}/3`,
  ACCESS_CODE,
  CRON_SECRET: "e2e-cron-secret-0123456789",
  BETTER_AUTH_SECRET: "e2e-auth-secret-0123456789abcdef0123",
  BETTER_AUTH_URL: `http://localhost:${appPort(worker)}`,
});
