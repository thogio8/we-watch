import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { vi } from "vitest";
import { createDatabase, type Database } from "@/db/create-database";
import { movies } from "@/db/schema";
import { fakeTmdb } from "../fake-tmdb/handler";

export const CRON_SECRET = "functional-cron-secret";

/**
 * The real server stack (Server Actions → container → repository → SQLite,
 * TMDB client → zod → mapping) on a fresh database file, with TMDB answered
 * by the fake catalogue. Call once per test file, before any test runs.
 */
export async function startServerStack(): Promise<{
  reset: () => Promise<void>;
}> {
  const url = `file:${join(mkdtempSync(join(tmpdir(), "we-watch-")), "app.db")}`;
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("DATABASE_AUTH_TOKEN", "");
  vi.stubEnv("TMDB_ACCESS_TOKEN", "fake-token");
  vi.stubEnv("TMDB_API_URL", "https://tmdb.test/3");
  vi.stubEnv("ACCESS_CODE", "pop corn ce soir");
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.stubEnv("BETTER_AUTH_SECRET", "functional-auth-secret-0123456789abcdef");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubGlobal("fetch", async (input: string | URL) => fakeTmdb(input));

  const db: Database = createDatabase(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  return {
    reset: async () => {
      await db.delete(movies);
    },
  };
}
