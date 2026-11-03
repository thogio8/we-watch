// Rehearses the 2.0 cutover on a copy of production, before it happens:
//   1. a new database at the 1.3.x schema (0000–0001, drizzle's migrator on
//      a copy of drizzle/ whose journal stops there: what production has);
//   2. the `movies` rows of a 1.3.x backup (the CI's `movies.json`);
//   3. `npm run db:migrate`, the CI's own command, on that database;
//   4. verify(): « NOUS DEUX » holds every movie with its status and dates.
// Prints counts and durations, never a title nor a date. Exits 1 on any gap.
// The target must hold no table: it is never production.
// Usage: node scripts/rehearse-migration.mjs <backup> [--db <file or URL>]
//        (default .rehearsal/prod-copy.db; a URL uses DATABASE_AUTH_TOKEN)
//        DATABASE_URL=… node scripts/rehearse-migration.mjs --probe
//        (prints PRAGMA foreign_keys of DATABASE_URL, reads nothing else)
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { insertsInto } from "./insert-rows.mjs";
import { readBackup } from "./read-backup.mjs";
import { count, verify } from "./verify-rehearsal.mjs";

/** Migrations production had in 1.3.x: 0000 and 0001. */
const IN_1_3 = 2;
const MIGRATIONS = "select count(*) from __drizzle_migrations";
const authToken = () => process.env.DATABASE_AUTH_TOKEN || undefined;

/** drizzle/ with its journal cut after 1.3.x, in a throwaway folder. */
async function migrateTo13(db) {
  const dir = mkdtempSync(join(tmpdir(), "we-watch-1.3-"));
  try {
    cpSync("drizzle", dir, { recursive: true });
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    );
    journal.entries = journal.entries.slice(0, IN_1_3);
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    await migrate(drizzle(db), { migrationsFolder: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The CI's migration command, on `url` only. */
function migrateLikeTheCi(url) {
  const result = spawnSync("npm", ["run", "--silent", "db:migrate"], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      DATABASE_AUTH_TOKEN: authToken() ?? "",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.status !== 0)
    throw new Error(`npm run db:migrate a échoué (code ${result.status})`);
}

function backupOf(path) {
  const backup = readBackup(path, process.env.BACKUP_KEY);
  if ("app_group" in backup)
    throw new Error("sauvegarde 2.0 : la restaurer avec restore-db");
  if (!("movies" in backup)) throw new Error("sauvegarde sans movies");
  return backup.movies;
}

function targetUrl(db) {
  if (/^[a-z]+:/.test(db)) return db;
  mkdirSync(dirname(resolve(db)), { recursive: true });
  return `file:${resolve(db)}`;
}

async function rehearse(path, db) {
  const movies = backupOf(path);
  const url = targetUrl(db);
  const client = createClient({ url, authToken: authToken(), timeout: 5000 });
  try {
    const tables = await count(
      client,
      "select count(*) from sqlite_master where type = 'table'",
    );
    if (tables > 0)
      throw new Error(
        "base cible non vide : répéter seulement dans une base neuve",
      );
    const started = performance.now();
    await migrateTo13(client);
    const in13 = await count(client, MIGRATIONS);
    if (movies.length > 0)
      await client.batch(await insertsInto(client, "movies", movies), "write");
    const migrating = performance.now();
    migrateLikeTheCi(url);
    const done = performance.now();
    const { report, failures } = await verify(client);
    console.log(
      `migrations : ${in13} (1.3.x), puis ${await count(client, MIGRATIONS)}`,
    );
    for (const line of report) console.log(line);
    console.log(`durée de la migration : ${Math.round(done - migrating)} ms`);
    console.log(`durée totale : ${Math.round(done - started)} ms`);
    for (const failure of failures) console.error(`écart : ${failure}`);
    return failures.length === 0 ? 0 : 1;
  } finally {
    client.close();
  }
}

async function probe() {
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: authToken(),
  });
  try {
    console.log(`foreign_keys: ${await count(client, "pragma foreign_keys")}`);
  } finally {
    client.close();
  }
}

async function main([first, ...rest]) {
  if (first === "--probe") return probe();
  if (!first)
    throw new Error(
      "usage: node scripts/rehearse-migration.mjs <sauvegarde> [--db <cible>]",
    );
  const at = rest.indexOf("--db");
  process.exitCode = await rehearse(
    first,
    at === -1 ? ".rehearsal/prod-copy.db" : rest[at + 1],
  );
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`répétition échouée : ${error.message}`);
  process.exitCode = 1;
}
