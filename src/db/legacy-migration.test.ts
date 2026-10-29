import { readFileSync } from "node:fs";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { LEGACY_GROUP_ID, LEGACY_GROUP_NAME } from "@/domain/group";
import { createDatabase } from "./create-database";
import { group } from "./group-schema";

// The 2.2 migration runs on the production list (1.3.x rows) before the new
// code: it applies the real SQL files, in journal order, on a database
// seeded the way 1.3.x left it.

type Journal = { entries: { idx: number; tag: string }[] };
const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
) as Journal;
const tags = journal.entries.map((entry) => entry.tag);
const BEFORE_GROUPS = tags.slice(0, 5);
const GROUPS = tags.slice(5, 7);
const COPY = "0006_copy_list_to_legacy_group";

const sqlOf = (tag: string) => readFileSync(`drizzle/${tag}.sql`, "utf8");

async function apply(client: Client, migrations: readonly string[]) {
  for (const tag of migrations) {
    const statements = sqlOf(tag)
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => statement !== "");
    await client.batch(statements, "write");
  }
}

const OLD_MOVIES = `INSERT INTO movies (tmdb_id, title, release_year,
  runtime_minutes, overview, poster_path, vote_average, providers, genre_ids,
  trailer_key, status, decided_at, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?)`;

const NETFLIX = '[{"id":8,"name":"Netflix","logoPath":"/n.jpg"}]';

// to_watch, watched (with watched_at), rejected by « BOF », rejected after
// being removed from the list: the last two are indistinguishable.
const OLD_ROWS: InStatement[] = [
  [
    244786,
    "Whiplash",
    2014,
    107,
    "Un batteur…",
    "/w.jpg",
    8.4,
    NETFLIX,
    "[18,10402]",
    "7d_jQycdQGo",
    "to_watch",
    1792746100000,
    null,
  ],
  [
    129,
    "Le Voyage de Chihiro",
    2001,
    125,
    "« Chihiro », 10 ans",
    null,
    8.5,
    "[]",
    "[16,14]",
    null,
    "watched",
    1792746200000,
    1793000000123,
  ],
  [
    496243,
    "Parasite",
    2019,
    null,
    "",
    "/p.jpg",
    8.5,
    "[]",
    "[]",
    null,
    "rejected",
    1792746300000,
    null,
  ],
  [
    194,
    "Le Fabuleux Destin d’Amélie Poulain",
    null,
    122,
    "Amélie",
    "/a.jpg",
    7.9,
    NETFLIX,
    "[35,10749]",
    null,
    "rejected",
    1792746400000,
    null,
  ],
].map((args) => ({ sql: OLD_MOVIES, args }));

const SNAPSHOT_COLUMNS = `tmdb_id, quote(title), quote(release_year),
  quote(runtime_minutes), quote(overview), quote(poster_path),
  quote(vote_average), quote(providers), quote(genre_ids), quote(trailer_key)`;

let client: Client;

const rows = async (sql: string) => (await client.execute(sql)).rows;
const allMovies = () => rows("SELECT * FROM movies ORDER BY tmdb_id");
const moviesDdl = () =>
  rows("SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'movies'");

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await apply(client, BEFORE_GROUPS);
});

describe("migration de la liste vers « NOUS DEUX »", () => {
  it("applique exactement 0005 et 0006 après les migrations de la 2.1", () => {
    expect(BEFORE_GROUPS.at(-1)).toBe("0004_signup_ticket_use");
    expect(GROUPS[0]).toMatch(/^0005_/);
    expect(GROUPS[1]).toBe(COPY);
  });

  it("écrit dans le SQL l'id et le nom du groupe hérité du domaine", () => {
    expect(sqlOf(COPY)).toContain(
      `'${LEGACY_GROUP_ID}', '${LEGACY_GROUP_NAME}'`,
    );
  });

  describe("sur la liste de la 1.3", () => {
    beforeEach(() => client.batch(OLD_ROWS, "write"));

    it("crée le groupe « NOUS DEUX », sans membre", async () => {
      const before = Date.now();
      await apply(client, GROUPS);

      const groups = await rows("SELECT id, name, created_at FROM app_group");
      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({
        id: LEGACY_GROUP_ID,
        name: LEGACY_GROUP_NAME,
      });
      expect(groups[0]?.created_at).toBeGreaterThanOrEqual(before - 1);
      expect(groups[0]?.created_at).toBeLessThanOrEqual(Date.now() + 1);
      expect(await rows("SELECT * FROM membership")).toEqual([]);
    });

    it("copie chaque film avec son statut et ses dates, sans auteur", async () => {
      const decisions = await rows(
        `SELECT '${LEGACY_GROUP_ID}' AS group_id, tmdb_id, status, decided_at,
          watched_at FROM movies ORDER BY tmdb_id`,
      );
      await apply(client, GROUPS);

      expect(
        await rows(
          `SELECT group_id, tmdb_id, status, decided_at, watched_at
            FROM group_movie ORDER BY tmdb_id`,
        ),
      ).toEqual(decisions);
      expect(
        await rows(
          `SELECT DISTINCT legacy, added_via, quote(added_by) AS added_by,
            quote(watched_by) AS watched_by FROM group_movie`,
        ),
      ).toEqual([
        {
          legacy: 1,
          added_via: "legacy",
          added_by: "NULL",
          watched_by: "NULL",
        },
      ]);
      expect(await rows("SELECT * FROM movie_want")).toEqual([]);
      expect(await rows("SELECT * FROM movie_rejection")).toEqual([]);
    });

    it("garde des écartés pour le groupe les films BOF comme les retirés", async () => {
      await apply(client, GROUPS);

      expect(
        await rows(
          "SELECT tmdb_id FROM group_movie WHERE status = 'rejected' ORDER BY tmdb_id",
        ),
      ).toEqual([{ tmdb_id: 194 }, { tmdb_id: 496243 }]);
    });

    it("copie les instantanés à l’identique", async () => {
      const snapshots = await rows(
        `SELECT ${SNAPSHOT_COLUMNS} FROM movies ORDER BY tmdb_id`,
      );
      await apply(client, GROUPS);

      expect(
        await rows(
          `SELECT ${SNAPSHOT_COLUMNS} FROM movie_snapshot ORDER BY tmdb_id`,
        ),
      ).toEqual(snapshots);
    });

    it("laisse la table movies intacte, données et définition", async () => {
      const movies = await allMovies();
      const ddl = await moviesDdl();
      await apply(client, GROUPS);

      expect(await allMovies()).toEqual(movies);
      expect(await moviesDdl()).toEqual(ddl);
      expect(movies).toHaveLength(OLD_ROWS.length);
    });

    it("respecte toutes les clés étrangères", async () => {
      await apply(client, GROUPS);

      expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
    });
  });

  it("sur une base sans film, ne crée ni groupe ni ligne", async () => {
    await apply(client, GROUPS);

    for (const table of ["app_group", "movie_snapshot", "group_movie"]) {
      expect(await rows(`SELECT * FROM ${table}`)).toEqual([]);
    }
  });

  it("passe avec le migrateur de Drizzle sur une base neuve, comme les tests et l’e2e", async () => {
    const db = createDatabase(":memory:");
    await migrate(db, { migrationsFolder: "drizzle" });

    const applied = await db.get<{ n: number }>(
      sql`SELECT count(*) AS n FROM __drizzle_migrations`,
    );
    expect(applied.n).toBe(tags.length);
    expect(await db.$count(group)).toBe(0);
  });
});
