import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { beforeEach, describe, expect, it } from "vitest";
import { LEGACY_GROUP_ID } from "@/domain/group";
import {
  migrationTags,
  statementsIn,
  statementsOf,
} from "../helpers/migrations";

// After a return to 1.3.x, the list went on in `movies` while the groups
// stood still. Re-cutting over ships this SQL as a migration: it brings the
// 1.3.x changes into « NOUS DEUX » the way 0006 + 0007 did. Applied here on
// a database migrated 0000 to the last one, like production.

const REPLAY = "scripts/replay-legacy-movies.sql";
const CUTOVER = 1_800_000_000_000;
const BEFORE = CUTOVER - 1_000_000;
const ON_2_0 = CUTOVER + 1_000;
const ON_1_3 = CUTOVER + 2_000;

let client: Client;
const run = (statements: string[]) => client.batch(statements, "write");
const rows = async (sql: string) => (await client.execute(sql)).rows;
const replay = () => run(statementsIn(REPLAY));
const everything = async () => {
  const tables = await rows(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  const all: Record<string, unknown> = {};
  for (const { name } of tables)
    all[String(name)] = await rows(`SELECT * FROM "${String(name)}"`);
  return all;
};
const listed = (tmdbId: number) =>
  rows(`SELECT status, watched_at, quote(watched_by) AS watched_by, legacy,
    watched_legacy, added_via, quote(added_by) AS added_by
    FROM group_movie WHERE group_id = '${LEGACY_GROUP_ID}' AND tmdb_id = ${tmdbId}`);

/** A 1.3.x row of `movies`. */
const movie = (
  tmdbId: number,
  status: string,
  watchedAt: number | null,
  at = BEFORE,
) =>
  `INSERT INTO movies (tmdb_id, title, overview, vote_average, status, decided_at, watched_at)
    VALUES (${tmdbId}, 'Film ${tmdbId}', '', 7.5, '${status}', ${at}, ${watchedAt})`;
const watchedOn13 = (tmdbId: number) =>
  `UPDATE movies SET status = 'watched', watched_at = ${ON_1_3} WHERE tmdb_id = ${tmdbId}`;

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  const [beforeGroups, groups] = [
    migrationTags.slice(0, 5),
    migrationTags.slice(5),
  ];
  for (const tag of beforeGroups) await run(statementsOf(tag));
  // The list at the cutover.
  await run([
    movie(244786, "to_watch", null),
    movie(129, "watched", BEFORE),
    movie(496243, "rejected", null),
    movie(680, "to_watch", null),
    movie(13, "watched", BEFORE),
    movie(550, "to_watch", null),
    movie(278, "to_watch", null),
  ]);
  for (const tag of groups) await run(statementsOf(tag));
  // On 2.0: Hugo unmarks 13 and marks 550 watched.
  await run([
    `UPDATE app_group SET created_at = ${CUTOVER}`,
    "INSERT INTO user (id, name, email) VALUES ('hugo', 'Hugo', 'h@x')",
    `UPDATE group_movie SET status = 'to_watch', watched_at = NULL, watched_legacy = 0 WHERE tmdb_id = 13`,
    `UPDATE group_movie SET status = 'watched', watched_at = ${ON_2_0}, watched_by = 'hugo' WHERE tmdb_id = 550`,
    `UPDATE movie_snapshot SET title = 'Whiplash (TMDB)' WHERE tmdb_id = 244786`,
  ]);
});

describe("rattrapage de la liste 1.3.x après un retour arrière", () => {
  beforeEach(() =>
    // Back on 1.3.x: watched 680 and 550, watched 129 again, removed 278,
    // added 11, 120 (then watched it) and 999 (« BOF »).
    run([
      watchedOn13(680),
      watchedOn13(129),
      watchedOn13(550),
      "UPDATE movies SET status = 'rejected' WHERE tmdb_id = 278",
      movie(11, "to_watch", null, ON_1_3),
      movie(120, "watched", ON_1_3, ON_1_3),
      movie(999, "rejected", null, ON_1_3),
    ]),
  );

  it("écrit dans le SQL l'id du groupe hérité du domaine", () => {
    expect(readFileSync(REPLAY, "utf8")).toContain(`'${LEGACY_GROUP_ID}'`);
  });

  it("copie les films ajoutés pendant le retour, comme 0006 + 0007 : copiés, sans auteur", async () => {
    await replay();

    const copied = {
      legacy: 1,
      added_via: "legacy",
      added_by: "NULL",
      watched_by: "NULL",
    };
    expect(await listed(11)).toEqual([
      { ...copied, status: "to_watch", watched_at: null, watched_legacy: 0 },
    ]);
    expect(await listed(120)).toEqual([
      { ...copied, status: "watched", watched_at: ON_1_3, watched_legacy: 1 },
    ]);
    expect(await listed(999)).toEqual([
      { ...copied, status: "rejected", watched_at: null, watched_legacy: 0 },
    ]);
    expect(
      await rows(
        "SELECT title FROM movie_snapshot WHERE tmdb_id IN (11, 120, 999)",
      ),
    ).toHaveLength(3);
  });

  it("marque vu un film du groupe que la 1.3.x a marqué vu et que personne n'a marqué", async () => {
    await replay();

    expect(await listed(680)).toEqual([
      expect.objectContaining({
        status: "watched",
        watched_at: ON_1_3,
        watched_by: "NULL",
        watched_legacy: 1,
        legacy: 1,
      }),
    ]);
  });

  it("laisse intact un film marqué vu par un membre", async () => {
    const before = await listed(550);
    await replay();

    expect(await listed(550)).toEqual(before);
    expect(before[0]).toMatchObject({
      watched_at: ON_2_0,
      watched_by: "'hugo'",
    });
  });

  it("ne remarque pas vu un film qu'un membre a démarqué sur la 2.0", async () => {
    await replay();

    expect(await listed(13)).toEqual([
      expect.objectContaining({ status: "to_watch", watched_at: null }),
    ]);
  });

  it("ne rattrape pas un film du groupe retiré pendant le retour (à faire à la main)", async () => {
    await replay();

    expect(await listed(278)).toEqual([
      expect.objectContaining({ status: "to_watch" }),
    ]);
  });

  it("ne touche ni aux autres films (129, déjà vu, revu sur la 1.3.x), ni aux instantanés existants, ni à movies, ni aux souhaits", async () => {
    const untouched = `SELECT * FROM group_movie WHERE tmdb_id IN (244786, 129, 496243) ORDER BY tmdb_id`;
    const [list, movies, snapshot] = [
      await rows(untouched),
      await rows("SELECT * FROM movies ORDER BY tmdb_id"),
      await rows("SELECT * FROM movie_snapshot WHERE tmdb_id = 244786"),
    ];
    await replay();

    expect(await rows(untouched)).toEqual(list);
    expect(await rows("SELECT * FROM movies ORDER BY tmdb_id")).toEqual(movies);
    expect(
      await rows("SELECT * FROM movie_snapshot WHERE tmdb_id = 244786"),
    ).toEqual(snapshot);
    expect(snapshot[0]?.title).toBe("Whiplash (TMDB)");
    expect(await rows("SELECT * FROM movie_want")).toEqual([]);
    expect(await rows("SELECT * FROM movie_rejection")).toEqual([]);
    expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("un second passage ne change rien", async () => {
    await replay();
    const once = await everything();
    await replay();

    expect(await everything()).toEqual(once);
  });
});

it("sans le groupe « NOUS DEUX », n'écrit rien", async () => {
  await run([
    `DELETE FROM group_movie WHERE group_id = '${LEGACY_GROUP_ID}'`,
    `DELETE FROM app_group WHERE id = '${LEGACY_GROUP_ID}'`,
    watchedOn13(680),
    movie(11, "to_watch", null, ON_1_3),
  ]);
  const before = await everything();
  await replay();

  expect(await everything()).toEqual(before);
});
