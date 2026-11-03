import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verify } from "../../scripts/verify-rehearsal.mjs";
import { migrationTags } from "../helpers/migrations";

// Before the cutover, the 2.0 migrations run on a copy of production: the
// last 1.3.x backup (the CI's `movies.json`, an array of `movies` rows) put
// into a database at the 1.3.x schema (0000–0001), then `npm run db:migrate`
// like the CI. Here on throwaway files.

const SCRIPT = "scripts/rehearse-migration.mjs";

let dir: string;
let target: string;
let client: Client | undefined;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-rehearse-"));
  target = join(dir, "copy.db");
});
afterEach(() => {
  client?.close();
  client = undefined;
  rmSync(dir, { recursive: true, force: true });
});

/** A 1.3.x `movies` row, as the 1.3.x backup wrote it. */
const movie = (
  tmdbId: number,
  status: string,
  watchedAt: number | null = null,
) => ({
  tmdb_id: tmdbId,
  title: `Film secret ${tmdbId}`,
  release_year: 2014,
  runtime_minutes: 107,
  overview: "Un batteur…",
  poster_path: "/w.jpg",
  vote_average: 8.4,
  providers: "[]",
  status,
  decided_at: 1_792_746_100_000 + tmdbId,
  watched_at: watchedAt,
  genre_ids: "[18]",
  trailer_key: null,
});

// To watch, watched, set aside (« BOF ») and removed: the last two are both
// `rejected` in 1.3.x.
const LIST = [
  movie(244786, "to_watch"),
  movie(129, "watched", 1_793_000_000_123),
  movie(550, "watched", 1_793_000_000_456),
  movie(496243, "rejected"),
  movie(194, "rejected"),
];

function backupOf(rows: unknown) {
  const file = join(dir, "movies.json");
  writeFileSync(file, JSON.stringify(rows));
  return file;
}

function rehearse(args: string[], env: Record<string, string> = {}) {
  return spawnSync("node", [SCRIPT, ...args], {
    env: { ...process.env, DATABASE_AUTH_TOKEN: "", ...env },
    encoding: "utf8",
  });
}

const open = () => (client ??= createClient({ url: `file:${target}` }));
const rows = async (sql: string) => (await open().execute(sql)).rows;

describe(
  "répétition de la migration sur une sauvegarde 1.3.x",
  { timeout: 60_000 },
  () => {
    it("migre la liste dans « NOUS DEUX » et affiche les comptes, jamais une donnée", async () => {
      const result = rehearse([backupOf(LIST), "--db", target]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      for (const line of [
        `migrations : 2 (1.3.x), puis ${migrationTags.length}`,
        "movies: 5",
        "nous-deux: 5",
        "movie_snapshot: 5",
        "statuts: rejected=2, to_watch=1, watched=2",
        "watched_legacy: 2",
        "membership: 0",
        "foreign_key_check: ok",
        "integrity_check: ok",
      ])
        expect(result.stdout).toContain(line);
      expect(result.stdout).toMatch(/durée de la migration : \d+ ms/);
      expect(result.stdout).not.toContain("Film secret");
      expect(
        await rows("SELECT count(*) AS n FROM __drizzle_migrations"),
      ).toEqual([{ n: migrationTags.length }]);
    });

    it("sur une liste vide : aucun groupe, code 0", async () => {
      const result = rehearse([backupOf([]), "--db", target]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("movies: 0");
      expect(await rows("SELECT * FROM app_group")).toEqual([]);
    });

    it("refuse une base cible qui a déjà une table, sans y toucher", async () => {
      await open().execute("CREATE TABLE autre (x)");

      const result = rehearse([backupOf(LIST), "--db", target]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("base cible non vide");
      expect(
        await rows("SELECT name FROM sqlite_master WHERE type = 'table'"),
      ).toEqual([{ name: "autre" }]);
    });

    it.each([
      [
        "une sauvegarde 2.0",
        { app_group: [], movies: [] },
        "sauvegarde 2.0 : la restaurer avec restore-db",
      ],
      ["une sauvegarde sans movies", {}, "sauvegarde sans movies"],
      ["un fichier illisible", "pas du JSON", "format de sauvegarde inconnu"],
    ])("refuse %s", (_, content, message) => {
      const file = join(dir, "backup.json");
      writeFileSync(
        file,
        typeof content === "string" ? content : JSON.stringify(content),
      );

      const result = rehearse([file, "--db", target]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
    });

    it("sort en code 1 sur une sauvegarde qui ne s'insère pas (un film en double)", () => {
      const result = rehearse([backupOf([...LIST, LIST[0]]), "--db", target]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("SQLITE_CONSTRAINT");
      expect(result.stderr).not.toContain("Film secret");
    });

    it("--probe lit PRAGMA foreign_keys de DATABASE_URL et affiche 0 ou 1", () => {
      const result = rehearse(["--probe"], { DATABASE_URL: `file:${target}` });

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/^foreign_keys: [01]\n$/);
    });

    describe("la vérification d'une base répétée", () => {
      beforeEach(() => {
        expect(rehearse([backupOf(LIST), "--db", target]).status).toBe(0);
      });

      it("ne trouve aucun écart", async () => {
        expect((await verify(open())).failures).toEqual([]);
      });

      it.each([
        [
          "une ligne de « NOUS DEUX » supprimée",
          "DELETE FROM group_movie WHERE tmdb_id = 129",
          "nous-deux : attendu 5, reçu 4",
        ],
        [
          "une date de décision changée",
          "UPDATE group_movie SET decided_at = 1 WHERE tmdb_id = 194",
          "films sans leur copie exacte : attendu 0, reçu 1",
        ],
        [
          "une date de visionnage changée",
          "UPDATE group_movie SET watched_at = 2 WHERE tmdb_id = 129",
          "films sans leur copie exacte : attendu 0, reçu 1",
        ],
        [
          "un statut changé",
          "UPDATE group_movie SET status = 'to_watch' WHERE tmdb_id = 194",
          "statuts : attendu rejected=2, to_watch=1, watched=2, reçu rejected=1, to_watch=2, watched=2",
        ],
        [
          "un « vu avant les comptes » perdu",
          "UPDATE group_movie SET watched_legacy = 0 WHERE tmdb_id = 550",
          "watched_legacy : attendu 2, reçu 1",
        ],
        [
          "un instantané en moins",
          "PRAGMA foreign_keys = OFF; DELETE FROM movie_snapshot WHERE tmdb_id = 550",
          "movie_snapshot : attendu 5, reçu 4",
        ],
        [
          "un membre",
          `INSERT INTO user (id, name, email) VALUES ('u', 'U', 'u@x');
         INSERT INTO membership (group_id, user_id) VALUES ('nous-deux', 'u')`,
          "membership : attendu 0, reçu 1",
        ],
      ])("signale %s", async (_, change, failure) => {
        await open().executeMultiple(change);

        const { failures } = await verify(open());

        expect(failures).toContain(failure);
      });

      it("signale une clé étrangère cassée", async () => {
        await open().executeMultiple(
          "PRAGMA foreign_keys = OFF; DELETE FROM movie_snapshot WHERE tmdb_id = 129",
        );

        expect((await verify(open())).failures).toContain(
          "foreign_key_check : attendu ok, reçu 1 ligne(s) orpheline(s)",
        );
      });
    });
  },
);
