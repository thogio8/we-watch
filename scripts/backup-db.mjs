// Dumps the app's tables to one encrypted file (CI keeps it as an artifact)
// before a migration: { "<table>": [rows] }, encrypted with BACKUP_KEY
// (scripts/backup-crypto.mjs). Without a valid BACKUP_KEY it fails before
// reading anything and writes nothing: never a plaintext fallback.
// A table the database does not have yet (a 1.3.x database at the 2.0
// cutover: only `movies`) is left out.
// Reads DATABASE_URL / DATABASE_AUTH_TOKEN; prints row counts, never data
// nor secrets.
// Usage: node scripts/backup-db.mjs <out.json.enc>
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { encryptBackup, parseBackupKey } from "./backup-crypto.mjs";
import { TABLES } from "./backup-tables.mjs";

const columns = (list) =>
  list === "*" ? "*" : list.map((name) => `"${name}"`).join(", ");

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/backup-db.mjs <out.json.enc>");

// Checks the key before touching the database: a bad key fails fast.
try {
  parseBackupKey(process.env.BACKUP_KEY);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const names = Object.keys(TABLES);
const { rows: found } = await client.execute({
  sql: `select name from sqlite_master where type = 'table' and name in (${names.map(() => "?").join(", ")})`,
  args: names,
});
const existing = new Set(found.map(({ name }) => name));

const backup = {};
for (const [table, list] of Object.entries(TABLES)) {
  if (!existing.has(table)) {
    console.log(`${table}: absent`);
    continue;
  }
  // Names come from TABLES above, never from the outside.
  const { rows } = await client.execute(
    `select ${columns(list)} from "${table}"`,
  );
  backup[table] = rows;
  console.log(`${table}: ${rows.length} rows`);
}
client.close();
const envelope = encryptBackup(JSON.stringify(backup), process.env.BACKUP_KEY);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(envelope));
console.log(`saved to ${out} (encrypted)`);
