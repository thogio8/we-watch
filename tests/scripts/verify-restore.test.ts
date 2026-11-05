import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/create-database";
import { sql } from "../helpers/sql";

// The nightly restore rehearsal: a backup put back by restore-db.mjs, then
// checked table by table. Here on throwaway files.

const KEY = randomBytes(32).toString("hex");

let dir: string;
let source: string;
let target: string;
let backupFile: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-verify-"));
  source = `file:${join(dir, "source.db")}`;
  target = `file:${join(dir, "target.db")}`;
  backupFile = join(dir, "db.json.enc");
  for (const url of [source, target])
    await migrate(createDatabase(url), { migrationsFolder: "drizzle" });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const env = (url: string) => ({
  ...process.env,
  DATABASE_URL: url,
  DATABASE_AUTH_TOKEN: "",
  BACKUP_KEY: KEY,
});

const SOURCE_ROWS = [
  "INSERT INTO user (id, name, email) VALUES ('u-1', 'Prénom-Secret', 'u@x.invalid')",
  "INSERT INTO app_group (id, name, created_at) VALUES ('g-1', 'G', 1)",
  `INSERT INTO movie_snapshot (tmdb_id, title, overview, vote_average)
     VALUES (1, 'Film-Secret', '', 1), (2, 'Autre-Secret', '', 2)`,
  `INSERT INTO group_movie (group_id, tmdb_id, status, decided_at, added_via)
     VALUES ('g-1', 1, 'to_watch', 1, 'swipe'), ('g-1', 2, 'to_watch', 2, 'swipe')`,
];

/** Real backup of the source, real restore into the target. */
async function backedUpAndRestored() {
  await sql(source, SOURCE_ROWS);
  execFileSync("node", ["scripts/backup-db.mjs", backupFile], {
    env: env(source),
  });
  execFileSync("node", ["scripts/restore-db.mjs", backupFile], {
    env: env(target),
  });
}

function verify(file = backupFile) {
  return spawnSync("node", ["scripts/verify-restore.mjs", file], {
    env: env(target),
    encoding: "utf8",
  });
}

function plainBackup(content: unknown) {
  const file = join(dir, "db.json");
  writeFileSync(file, JSON.stringify(content));
  return file;
}

describe("exercice de restauration", () => {
  it("compte les films vus avant les comptes (watched_legacy à 1), un nombre seulement", async () => {
    await backedUpAndRestored();
    expect(verify().stdout).toContain("group_movie.watched_legacy à 1 : 0");

    await sql(source, [
      "UPDATE group_movie SET watched_legacy = 1 WHERE tmdb_id = 2",
    ]);
    execFileSync("node", ["scripts/backup-db.mjs", backupFile], {
      env: env(source),
    });

    const result = verify();
    expect(result.stdout).toContain("group_movie.watched_legacy à 1 : 1");
    expect(result.stdout).not.toContain("Secret");
  });

  it("une sauvegarde restaurée se vérifie table par table", async () => {
    await backedUpAndRestored();

    const result = verify();

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("user: 1 rows ✓");
    expect(result.stdout).toContain("group_movie: 2 rows ✓");
    expect(result.stdout).toContain("restauration vérifiée");
  });

  it("une ligne manquante après restauration est nommée et fait échouer", async () => {
    await backedUpAndRestored();
    await sql(target, ["DELETE FROM group_movie WHERE tmdb_id = 2"]);

    const result = verify();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("group_movie: 2 attendues, 1 trouvées");
    expect(result.stdout).toContain("restauration incomplète");
    expect(result.stdout).not.toContain("restauration vérifiée");
  });

  it("une table absente de la sauvegarde est dite, sans échec", async () => {
    const file = plainBackup({
      user: [{ id: "u-1", name: "Léa", email: "u@x.invalid" }],
      app_group: [],
    });
    await sql(target, SOURCE_ROWS.slice(0, 1));

    const result = verify(file);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("passkey: absente de la sauvegarde");
    expect(result.stdout).toContain("user: 1 rows ✓");
    expect(result.stdout).toContain("restauration vérifiée");
  });

  it("une sauvegarde vide échoue", () => {
    const result = verify(plainBackup({ user: [], app_group: [] }));

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("sauvegarde vide");
  });

  it("la sortie ne contient ni la clé ni une donnée", async () => {
    await backedUpAndRestored();

    const result = verify();

    for (const secret of [KEY, "Prénom-Secret", "Film-Secret"])
      expect(result.stdout + result.stderr).not.toContain(secret);
  });
});
