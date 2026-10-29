// Dumps every app table to one JSON file (CI keeps it as an artifact) before
// a migration: { "<table>": [rows] }. A table the database does not have yet
// (first deploy, or before the groups migration) is left out.
// Reads DATABASE_URL / DATABASE_AUTH_TOKEN; prints row counts, never data
// nor secrets.
// Usage: node scripts/backup-db.mjs <out.json>
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";

/** The lists and groups; Better Auth's tables are not ours to restore. */
const TABLES = [
  "movies",
  "movie_snapshot",
  "app_group",
  "membership",
  "group_movie",
  "movie_want",
  "movie_rejection",
];

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/backup-db.mjs <out.json>");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const { rows: found } = await client.execute({
  sql: `select name from sqlite_master where type = 'table' and name in (${TABLES.map(() => "?").join(", ")})`,
  args: TABLES,
});
const existing = new Set(found.map(({ name }) => name));

const backup = {};
for (const table of TABLES) {
  if (!existing.has(table)) {
    console.log(`${table}: absent`);
    continue;
  }
  // Names come from TABLES above, never from the outside.
  const { rows } = await client.execute(`select * from "${table}"`);
  backup[table] = rows;
  console.log(`${table}: ${rows.length} rows`);
}
client.close();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(backup));
console.log(`saved to ${out}`);
