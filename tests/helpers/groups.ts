import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { onTestFinished } from "vitest";
import { user } from "@/db/auth-schema";
import { createDatabase, type Database } from "@/db/create-database";
import { group, groupMovie, membership } from "@/db/group-schema";

/** A fresh in-memory database, migrated (foreign keys enforced). */
export async function aDatabase(url = ":memory:"): Promise<Database> {
  const db = createDatabase(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

/**
 * The same in a file of its own, which several connections can open; closed
 * and deleted, folder included, once the test is over.
 */
export async function aFileDatabase() {
  const folder = mkdtempSync(join(tmpdir(), "we-watch-"));
  const url = `file:${join(folder, "app.db")}`;
  const db = await aDatabase(url);
  onTestFinished(() => {
    // drizzle keeps its client there; the `Database` type leaves it out.
    (db as Database & { $client: Client }).$client.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { url, db };
}

/** A real account row (authors and members are foreign keys): its id. */
export async function aUser(db: Database, name: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name, email: `${id}@test.invalid` });
  return id;
}

/** A group and its members, never used yet: its id. */
export async function aGroup(
  db: Database,
  name: string,
  members: readonly string[],
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(group).values({ id, name });
  if (members.length > 0) {
    await db
      .insert(membership)
      .values(members.map((userId) => ({ groupId: id, userId })));
  }
  return id;
}

/** The match columns of a movie's row, whatever its status; null: no row. */
export async function matchOf(db: Database, groupId: string, tmdbId: number) {
  const [row] = await db
    .select({ at: groupMovie.matchedAt, by: groupMovie.matchedBy })
    .from(groupMovie)
    .where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)));
  return row ?? null;
}
