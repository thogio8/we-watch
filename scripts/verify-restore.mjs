// Checks a restored database against the backup it came from (the nightly
// restore rehearsal): for every table of scripts/backup-tables.mjs, the
// restored table has as many rows as the backup. A table the backup lacks
// (absent from production) is said, not failed. A backup with no row at all
// fails: a production that serves has at least one user.
// Prints table names and row counts only, never data nor the key.
// Usage: BACKUP_KEY=… DATABASE_URL=… node scripts/verify-restore.mjs <backup>
import { createClient } from "@libsql/client";
import { TABLES } from "./backup-tables.mjs";
import { quote } from "./insert-rows.mjs";
import { readBackup } from "./read-backup.mjs";

/** One count per table the backup holds, from one read-mode batch. */
async function countRestored(client, tables) {
  if (tables.length === 0) return [];
  const results = await client.batch(
    tables.map((table) => `select count(*) as n from ${quote(table)}`),
    "read",
  );
  return results.map(({ rows }) => Number(rows[0]?.n));
}

/** The report lines, and whether every count matches. */
async function compare(client, backup) {
  const held = Object.keys(TABLES).filter((table) => table in backup);
  const found = await countRestored(client, held);
  const lines = [];
  let complete = true;
  for (const table of Object.keys(TABLES)) {
    const index = held.indexOf(table);
    if (index === -1) {
      lines.push(`${table}: absente de la sauvegarde`);
      continue;
    }
    const expected = backup[table].length;
    if (found[index] === expected) {
      lines.push(`${table}: ${expected} rows ✓`);
    } else {
      complete = false;
      lines.push(`${table}: ${expected} attendues, ${found[index]} trouvées`);
    }
  }
  return { lines, complete };
}

const path = process.argv[2];
let client;
try {
  if (!path) throw new Error("usage: node scripts/verify-restore.mjs <backup>");
  const backup = readBackup(path, process.env.BACKUP_KEY);
  const total = Object.values(backup).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  if (total === 0) throw new Error("sauvegarde vide");
  client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const { lines, complete } = await compare(client, backup);
  for (const line of lines) console.log(line);
  // Temporary (spec v2 §17): the column is dropped only once this reads 0.
  const watchedLegacy = (backup.group_movie ?? []).filter(
    (row) => Number(row.watched_legacy) === 1,
  ).length;
  console.log(`group_movie.watched_legacy à 1 : ${watchedLegacy}`);
  console.log(complete ? "restauration vérifiée" : "restauration incomplète");
  if (!complete) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client?.close();
}
