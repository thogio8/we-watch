import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/create-database";
import { readTables } from "../../scripts/backup-tables.mjs";

// The release job backs production up while the current version still
// serves: every table must come from one snapshot, or a row written between
// two reads could point to a row missing from the backup, and the restore
// (strict on foreign keys) would refuse it.

let dir: string;
let url: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-read-tables-"));
  url = `file:${join(dir, "app.db")}`;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** The client, recording each call that reads the tables. */
function spied(client: Client) {
  const calls: { method: string; statements: number; mode?: string }[] = [];
  const spy = Object.create(client) as Client;
  spy.execute = ((statement: InStatement) => {
    calls.push({ method: "execute", statements: 1 });
    return client.execute(statement);
  }) as Client["execute"];
  spy.batch = (statements, mode) => {
    calls.push({ method: "batch", statements: statements.length, mode });
    return client.batch(statements, mode);
  };
  return { spy, calls };
}

describe("lecture des tables à sauvegarder", () => {
  it("lit toutes les tables en un seul lot en lecture : un seul instantané", async () => {
    await migrate(createDatabase(url), { migrationsFolder: "drizzle" });
    const client = createClient({ url });
    await client.execute(
      "INSERT INTO app_group (id, name) VALUES ('g-1', 'NOUS DEUX')",
    );
    const { spy, calls } = spied(client);

    const { backup, report } = await readTables(spy);
    client.close();

    expect(calls).toEqual([
      { method: "execute", statements: 1 },
      { method: "batch", statements: 9, mode: "read" },
    ]);
    expect(backup.app_group).toEqual([
      expect.objectContaining({ id: "g-1", name: "NOUS DEUX" }),
    ]);
    expect(report).toContain("app_group: 1 rows");
  });

  it("une table absente n'est pas lue : seulement celles déjà là", async () => {
    const client = createClient({ url });
    await client.execute("CREATE TABLE user (id text primary key)");
    const { spy, calls } = spied(client);

    const { backup, report } = await readTables(spy);
    client.close();

    expect(calls.at(-1)).toEqual({
      method: "batch",
      statements: 1,
      mode: "read",
    });
    expect(backup).toEqual({ user: [] });
    expect(report).toContain("app_group: absent");
  });

  it("une base sans table : aucun lot, une sauvegarde vide", async () => {
    const client = createClient({ url });
    const { spy, calls } = spied(client);

    const { backup } = await readTables(spy);
    client.close();

    expect(calls).toEqual([{ method: "execute", statements: 1 }]);
    expect(backup).toEqual({});
  });
});
