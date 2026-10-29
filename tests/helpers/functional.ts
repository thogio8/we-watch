import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, vi } from "vitest";
import { user } from "@/db/auth-schema";
import { createDatabase, type Database } from "@/db/create-database";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "@/db/group-schema";
import { movies } from "@/db/schema";
import { fakeTmdb } from "../fake-tmdb/handler";
import { aGroup } from "./groups";

export const CRON_SECRET = "functional-cron-secret";

/** The mocked session's user (`vi.mock("@/server/session")`). */
const LEA = { id: "user-1", name: "Léa", email: "user-1@test.invalid" };

/**
 * The real server stack (Server Actions → container → repository → SQLite,
 * TMDB client → zod → mapping) on a fresh database file, with TMDB answered
 * by the fake catalogue. Call once per test file, before any test runs.
 * Léa, the mocked session's user, has an account row (foreign keys hold);
 * `reset` empties the lists and groups, children first.
 */
export async function startServerStack(): Promise<{
  db: Database;
  reset: () => Promise<void>;
}> {
  const url = `file:${join(mkdtempSync(join(tmpdir(), "we-watch-")), "app.db")}`;
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("DATABASE_AUTH_TOKEN", "");
  vi.stubEnv("TMDB_ACCESS_TOKEN", "fake-token");
  vi.stubEnv("TMDB_API_URL", "https://tmdb.test/3");
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.stubEnv("BETTER_AUTH_SECRET", "functional-auth-secret-0123456789abcdef");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubGlobal("fetch", async (input: string | URL) => fakeTmdb(input));

  const db: Database = createDatabase(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(user).values(LEA);
  return {
    db,
    reset: async () => {
      for (const table of [
        movieWant,
        movieRejection,
        groupMovie,
        membership,
        group,
        movieSnapshot,
        movies,
      ]) {
        await db.delete(table);
      }
    },
  };
}

/**
 * startServerStack for a file about one group: before each test, the lists
 * are emptied and Léa gets a fresh group « NOUS DEUX ». Read `id` and `db`
 * inside the tests.
 */
export function withLeasGroup(): { id: string; db: Database } {
  const mine = { id: "", db: undefined as unknown as Database };
  let reset: () => Promise<void>;
  beforeAll(async () => ({ db: mine.db, reset } = await startServerStack()));
  beforeEach(async () => {
    await reset();
    mine.id = await aGroup(mine.db, "NOUS DEUX", [LEA.id]);
  });
  return mine;
}
