// Puts a backup (scripts/read-backup.mjs: any format the CI ever kept) back
// into DATABASE_URL, which must be a new, already migrated database: it
// refuses a database that is not migrated or has a single row anywhere.
// Inserts the tables in the order of scripts/backup-tables.mjs (foreign keys
// first), in one write transaction: the check and every insert, all or
// nothing. Columns: those both the backup and the current schema have (an
// absent one takes its default; an unknown one is ignored and named).
// A 1.3.x backup (movies, no groups) is refused: nothing restores it since
// the 2.0 cutover.
// Prints row counts only, never data nor the key.
// Usage: BACKUP_KEY=… DATABASE_URL=… node scripts/restore-db.mjs <backup>
import { createClient } from "@libsql/client";
import { TABLES } from "./backup-tables.mjs";
import { insertsInto, quote } from "./insert-rows.mjs";
import { readBackup } from "./read-backup.mjs";

const ORDER = Object.keys(TABLES);
const MIGRATIONS = "__drizzle_migrations";
const PRE_2_0 =
  "sauvegarde d'avant 2.0 (1.3.x) : la restauration ne la prend pas";

/** Refuses anything but a 2.0 backup of the tables a restore knows. */
function checkBackup(backup) {
  if (!("app_group" in backup)) {
    throw new Error(
      "movies" in backup
        ? PRE_2_0
        : "sauvegarde sans app_group : ce n'est pas une sauvegarde 2.0",
    );
  }
  const unknown = Object.keys(backup).filter((name) => !ORDER.includes(name));
  if (unknown.length > 0) {
    throw new Error(`table inconnue : ${unknown.join(", ")}`);
  }
}

/** Migrated (every table of the backup and drizzle's journal) and empty. */
async function assertFresh(tx) {
  const { rows } = await tx.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite\\_%' escape '\\'",
  );
  const tables = rows.map(({ name }) => String(name));
  const missing = [MIGRATIONS, ...ORDER].filter(
    (name) => !tables.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `base cible non migrée (absentes : ${missing.join(", ")}) : migrer d'abord une base neuve`,
    );
  }
  const filled = [];
  for (const table of tables.filter((name) => name !== MIGRATIONS)) {
    const { rows: found } = await tx.execute(
      `select exists (select 1 from ${quote(table)}) as filled`,
    );
    if (found[0]?.filled) filled.push(table);
  }
  if (filled.length > 0) {
    throw new Error(
      `base cible non vide (${filled.join(", ")}) : restaurer seulement dans une base neuve`,
    );
  }
}

/** Writes the backup in one transaction; returns what to print. */
async function restore(client, backup) {
  const tx = await client.transaction("write");
  try {
    await assertFresh(tx);
    const statements = [];
    const report = [];
    for (const table of ORDER) {
      const rows = backup[table];
      if (rows === undefined) {
        report.push(`${table}: absente de la sauvegarde`);
        continue;
      }
      statements.push(...(await insertsInto(tx, table, rows)));
      report.push(`${table}: ${rows.length} rows`);
    }
    if (statements.length > 0) await tx.batch(statements);
    await tx.commit();
    return report;
  } finally {
    // Without commit (a refusal, a failed insert), closing rolls back.
    tx.close();
  }
}

const path = process.argv[2];
let client;
try {
  if (!path) throw new Error("usage: node scripts/restore-db.mjs <backup>");
  const backup = readBackup(path, process.env.BACKUP_KEY);
  checkBackup(backup);
  client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  for (const line of await restore(client, backup)) console.log(line);
  console.log("restored");
} catch (error) {
  console.error(`restauration refusée, rien n'est écrit : ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.close();
}
