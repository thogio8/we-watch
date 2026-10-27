// Dumps the movies table to a JSON file (CI keeps it as an artifact) before
// a migration. Reads DATABASE_URL / DATABASE_AUTH_TOKEN; prints no secret.
// Usage: node scripts/backup-db.mjs <out.json>
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/backup-db.mjs <out.json>");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const { rows } = await client.execute("select * from movies");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows));
console.log(`${rows.length} movies saved to ${out}`);
