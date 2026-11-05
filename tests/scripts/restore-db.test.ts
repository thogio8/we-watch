import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/create-database";
import { allRows } from "../helpers/rows";

// The worst day: production lost, its last backup (the CI's artifact) put
// back into a new, migrated database. Here on throwaway files.

const KEY = randomBytes(32).toString("hex");
const PRE_2_0 =
  "sauvegarde d'avant 2.0 (1.3.x) : la restauration ne la prend pas";

let dir: string;
let source: string;
let target: string;
let backupFile: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-restore-"));
  source = `file:${join(dir, "source.db")}`;
  target = `file:${join(dir, "target.db")}`;
  backupFile = join(dir, "db.json.enc");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const env = (url: string) => ({
  ...process.env,
  DATABASE_URL: url,
  DATABASE_AUTH_TOKEN: "",
  BACKUP_KEY: KEY,
});

const migrated = (url: string) =>
  migrate(createDatabase(url), { migrationsFolder: "drizzle" });

async function sql(url: string, statements: string[]) {
  const client = createClient({ url });
  await client.batch(statements, "write");
  client.close();
}

/** A row in every table a backup holds, with a member and a want. */
const EVERY_TABLE = [
  "INSERT INTO user (id, name, email) VALUES ('u-1', 'Léa', 'u-1@passkey.invalid')",
  `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
     VALUES ('pk-1', 'iPhone', 'PUBLIC-KEY', 'u-1', 'CRED-1', 3, 'multiDevice', 1, 1)`,
  "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('a-1', 'u-1', 'passkey', 'u-1', 3)",
  `INSERT INTO movie_snapshot (tmdb_id, title, overview, vote_average, providers)
     VALUES (244786, 'Whiplash', 'Un batteur…', 8.4, '[{"id":8}]'),
            (129, 'Le Voyage de Chihiro', '', 8.5, '[]')`,
  "INSERT INTO app_group (id, name, created_at) VALUES ('nous-deux', 'NOUS DEUX', 1)",
  "INSERT INTO membership (group_id, user_id, joined_at, last_used_at) VALUES ('nous-deux', 'u-1', 2, 3)",
  `INSERT INTO group_movie (group_id, tmdb_id, status, decided_at, watched_at, added_by, added_via, favorite_at, favorite_by, matched_at, matched_by)
     VALUES ('nous-deux', 244786, 'watched', 4, 5, 'u-1', 'swipe', NULL, NULL, NULL, NULL),
            ('nous-deux', 129, 'to_watch', 4, NULL, 'u-1', 'search', 8, 'u-1', 9, 'u-1')`,
  "INSERT INTO movie_want (group_id, tmdb_id, user_id, wanted_at) VALUES ('nous-deux', 244786, 'u-1', 6)",
  "INSERT INTO movie_rejection (user_id, tmdb_id, rejected_at) VALUES ('u-1', 129, 7)",
];

function backup() {
  execFileSync("node", ["scripts/backup-db.mjs", backupFile], {
    env: env(source),
  });
}

function restore(file = backupFile) {
  return spawnSync("node", ["scripts/restore-db.mjs", file], {
    env: env(target),
    encoding: "utf8",
  });
}

/** Rows of every table, each table's rows in a stable order. */
async function snapshot(url: string) {
  const all = await allRows(createDatabase(url));
  return Object.fromEntries(
    Object.entries(all).map(([table, rows]) => [
      table,
      rows.map((row) => JSON.stringify(row)).sort(),
    ]),
  );
}

function plainBackup(content: unknown) {
  const file = join(dir, "db.json");
  writeFileSync(file, JSON.stringify(content));
  return file;
}

describe("restauration d'une sauvegarde", () => {
  beforeEach(async () => {
    await migrated(source);
    await migrated(target);
  });

  it("dans une base neuve migrée : les mêmes lignes, table par table ; n'affiche que des comptes", async () => {
    await sql(source, EVERY_TABLE);
    backup();

    const result = restore();

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(await snapshot(target)).toEqual(await snapshot(source));
    expect(result.stdout).toContain("group_movie: 2 rows");
    for (const secret of ["Léa", "Whiplash", "PUBLIC-KEY", KEY])
      expect(result.stdout).not.toContain(secret);
  });

  it("refuse une base cible qui a déjà une ligne, sans rien écrire", async () => {
    await sql(source, EVERY_TABLE);
    backup();
    await sql(target, [
      "INSERT INTO rate_limit (key, count, window_start) VALUES ('k', 1, 1)",
    ]);
    const before = await snapshot(target);

    const result = restore();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("base cible non vide (rate_limit)");
    expect(await snapshot(target)).toEqual(before);
  });

  it.each([
    [
      "une clé en double",
      {
        movie_rejection: [
          { user_id: "u-1", tmdb_id: 1, rejected_at: 1 },
          { user_id: "u-1", tmdb_id: 1, rejected_at: 2 },
        ],
      },
    ],
    [
      "un film sans instantané (clé étrangère)",
      {
        group_movie: [
          {
            group_id: "g-1",
            tmdb_id: 5,
            status: "to_watch",
            decided_at: 1,
            added_via: "search",
          },
        ],
      },
    ],
  ])(
    "une ligne qui échoue (%s) annule toute la restauration",
    async (_, failing) => {
      const file = plainBackup({
        user: [{ id: "u-1", name: "Léa", email: "u@x" }],
        app_group: [{ id: "g-1", name: "G" }],
        ...failing,
      });
      const before = await snapshot(target);

      const result = restore(file);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("SQLITE_CONSTRAINT");
      expect(await snapshot(target)).toEqual(before);
    },
  );

  it("garde les colonnes communes : une colonne inconnue est ignorée et nommée, une absente prend son défaut", async () => {
    const file = plainBackup({
      app_group: [{ id: "g-1", name: "G", created_at: 1, gone_column: "x" }],
      group_movie: [],
      movie_snapshot: [
        { tmdb_id: 1, title: "T", overview: "", vote_average: 1 },
      ],
    });

    const result = restore(file);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("app_group: colonne ignorée gone_column");
    expect(result.stdout).toContain("passkey: absente de la sauvegarde");
    const rows = await snapshot(target);
    expect(rows.app_group).toEqual([
      JSON.stringify({
        id: "g-1",
        name: "G",
        created_at: 1,
        invite_token: null,
      }),
    ]);
    expect(rows.movie_snapshot?.[0]).toContain('"providers":"[]"');
  });

  it("une sauvegarde d’avant la suppression des restes (spec v2 §17) se restaure : movies et les deux colonnes sont ignorées et nommées", async () => {
    const file = plainBackup({
      app_group: [{ id: "g-1", name: "G", created_at: 1 }],
      movie_snapshot: [
        { tmdb_id: 1, title: "T", overview: "", vote_average: 1 },
      ],
      group_movie: [
        {
          group_id: "g-1",
          tmdb_id: 1,
          status: "to_watch",
          decided_at: 1,
          added_via: "legacy",
          legacy: 1,
          watched_legacy: 0,
        },
      ],
      movies: [{ tmdb_id: 1, title: "T", status: "to_watch", decided_at: 1 }],
    });

    const result = restore(file);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "group_movie: colonne ignorée legacy, watched_legacy",
    );
    expect(result.stdout).toContain("movies: table supprimée, ignorée");
    expect(result.stdout).toContain("group_movie: 1 rows");
  });

  it.each([
    ["le tableau movies.json de la 1.3.x", [{ tmdb_id: 1, title: "T" }]],
    ["un objet avec movies sans app_group", { movies: [], user: [] }],
  ])("refuse une sauvegarde d'avant 2.0 (%s)", async (_, content) => {
    const result = restore(plainBackup(content));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(PRE_2_0);
  });

  it.each([
    ["sans app_group", {}, "sauvegarde sans app_group"],
    [
      "avec une table inconnue",
      { app_group: [], session: [] },
      "table inconnue : session",
    ],
  ])("refuse une sauvegarde %s", (_, content, message) => {
    const result = restore(plainBackup(content));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it("refuse une sauvegarde chiffrée avec une autre clé, sans afficher la clé", async () => {
    await sql(source, EVERY_TABLE);
    backup();

    const result = spawnSync("node", ["scripts/restore-db.mjs", backupFile], {
      env: { ...env(target), BACKUP_KEY: "a".repeat(64) },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("sauvegarde illisible");
    expect(result.stderr + result.stdout).not.toContain("a".repeat(64));
  });
});

it("refuse une base cible non migrée", async () => {
  const file = plainBackup({ app_group: [] });

  const result = restore(file);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("base cible non migrée");
});
