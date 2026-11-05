import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { user } from "@/db/auth-schema";
import { createDatabase, type Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";

/** A fresh in-memory database, migrated (foreign keys enforced). */
export async function aDatabase(url = ":memory:"): Promise<Database> {
  const db = createDatabase(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

/** The same in a file of its own, which several connections can open. */
export async function aFileDatabase() {
  const url = `file:${join(mkdtempSync(join(tmpdir(), "we-watch-")), "app.db")}`;
  return { url, db: await aDatabase(url) };
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
