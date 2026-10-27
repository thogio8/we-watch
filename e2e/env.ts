export const E2E_PORT = 3217;
export const FAKE_TMDB_PORT = 3218;
export const E2E_DATABASE = "e2e/.data/e2e.db";
export const ACCESS_CODE = "e2e pop corn ce soir";

/** Overrides .env.production.local, which `next start` loads otherwise. */
export const E2E_ENV = {
  DATABASE_URL: `file:${E2E_DATABASE}`,
  DATABASE_AUTH_TOKEN: "",
  TMDB_ACCESS_TOKEN: "fake-token",
  TMDB_API_URL: `http://localhost:${FAKE_TMDB_PORT}/3`,
  ACCESS_CODE,
  CRON_SECRET: "e2e-cron-secret-0123456789",
};
