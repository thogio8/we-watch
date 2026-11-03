import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./create-database";

/**
 * Another process (an e2e fixture, a second server) holding the write lock
 * of `url` for `ms` milliseconds. Resolves once the lock is taken, with the
 * child's exit (wrapped: an async function would otherwise wait for it).
 */
async function lockFromAnotherProcess(url: string, ms: number) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const { createClient } = require("@libsql/client");
       const client = createClient({ url: ${JSON.stringify(url)} });
       (async () => {
         const tx = await client.transaction("write");
         await tx.execute("INSERT INTO t VALUES (1)");
         console.log("locked");
         setTimeout(async () => { await tx.commit(); client.close(); }, ${ms});
       })();`,
    ],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "inherit"] },
  );
  await once(child.stdout, "data");
  return { released: once(child, "exit") };
}

describe("createDatabase", () => {
  it("accepte un jeton d'authentification optionnel", () => {
    expect(createDatabase(":memory:", "token")).toBeDefined();
  });

  it("sur un fichier local, attend un verrou tenu par un autre processus au lieu d'échouer aussitôt", async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), "we-watch-")), "busy.db")}`;
    const setup = createClient({ url });
    await setup.execute("CREATE TABLE t (x INTEGER)");
    setup.close();
    const db = createDatabase(url);

    const { released } = await lockFromAnotherProcess(url, 300);
    await db.run(sql`INSERT INTO t VALUES (2)`);
    await released;

    expect(await db.all(sql`SELECT x FROM t ORDER BY x`)).toEqual([
      { x: 1 },
      { x: 2 },
    ]);
  });
});
