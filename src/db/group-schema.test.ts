import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { aSnapshot } from "@tests/helpers/movies";
import { user } from "./auth-schema";
import { createDatabase, type Database } from "./create-database";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";

let db: Database;

const NOW = new Date(2026, 9, 29);
const LEA = "lea";
const HUGO = "hugo";
const GROUP = "g1";

const aUser = (id: string) => ({ id, name: id, email: `${id}@x.invalid` });
const want = (userId: string, tmdbId = 1) => ({
  groupId: GROUP,
  tmdbId,
  userId,
  wantedAt: NOW,
});

beforeEach(async () => {
  db = createDatabase(":memory:");
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(user).values([aUser(LEA), aUser(HUGO)]);
  await db.insert(group).values({ id: GROUP, name: "NOUS DEUX" });
  await db.insert(membership).values([
    { groupId: GROUP, userId: LEA, joinedAt: NOW },
    { groupId: GROUP, userId: HUGO, joinedAt: NOW },
  ]);
  await db.insert(movieSnapshot).values([aSnapshot(1), aSnapshot(2)]);
  await db.insert(groupMovie).values({
    groupId: GROUP,
    tmdbId: 1,
    status: "watched",
    decidedAt: NOW,
    watchedAt: NOW,
    addedBy: LEA,
    watchedBy: LEA,
    addedVia: "swipe",
  });
  await db.insert(movieWant).values([want(LEA), want(HUGO)]);
  await db.insert(movieRejection).values({
    userId: LEA,
    tmdbId: 2,
    rejectedAt: NOW,
  });
});

const count = async (table: Parameters<Database["$count"]>[0]) =>
  db.$count(table);

describe("tables des groupes", () => {
  it("applique les clés étrangères (libSQL les active par défaut)", async () => {
    const pragma = await db.get<{ foreign_keys: number }>(
      sql`PRAGMA foreign_keys`,
    );

    expect(pragma.foreign_keys).toBe(1);
  });

  it("remplit les valeurs par défaut", async () => {
    const [created] = await db.select().from(group);
    const [member] = await db.select().from(membership);
    const [movie] = await db.select().from(groupMovie);

    expect(created?.createdAt).toBeInstanceOf(Date);
    expect(member?.lastUsedAt).toBeNull();
    expect(movie?.legacy).toBe(false);
  });

  it("supprime appartenances, liste et « voulu » avec le groupe", async () => {
    await db.delete(group).where(eq(group.id, GROUP));

    expect(await count(membership)).toBe(0);
    expect(await count(groupMovie)).toBe(0);
    expect(await count(movieWant)).toBe(0);
    expect(await count(movieSnapshot)).toBe(2);
  });

  it("supprime les « voulu » d’un film retiré de la liste", async () => {
    await db.delete(groupMovie).where(eq(groupMovie.tmdbId, 1));

    expect(await count(movieWant)).toBe(0);
  });

  it("garde le film d’un compte supprimé, sans auteur", async () => {
    await db.delete(user).where(eq(user.id, LEA));

    expect(await db.select().from(groupMovie)).toMatchObject([
      { tmdbId: 1, status: "watched", addedBy: null, watchedBy: null },
    ]);
    expect(await db.select().from(movieWant)).toEqual([want(HUGO)]);
    expect(await count(movieRejection)).toBe(0);
    expect(await db.select().from(membership)).toMatchObject([
      { userId: HUGO },
    ]);
  });

  it("refuse un film de liste sans instantané, et un « voulu » hors liste", async () => {
    await expect(
      db.insert(groupMovie).values({
        groupId: GROUP,
        tmdbId: 3,
        status: "to_watch",
        decidedAt: NOW,
        addedVia: "search",
      }),
    ).rejects.toThrow();
    await expect(db.insert(movieWant).values(want(LEA, 2))).rejects.toThrow();
  });

  it.each([
    [
      "une appartenance",
      () =>
        db
          .insert(membership)
          .values({ groupId: GROUP, userId: LEA, joinedAt: NOW }),
    ],
    [
      "un film de la liste",
      () =>
        db.insert(groupMovie).values({
          groupId: GROUP,
          tmdbId: 1,
          status: "to_watch",
          decidedAt: NOW,
          addedVia: "swipe",
        }),
    ],
    ["un « voulu »", () => db.insert(movieWant).values(want(LEA))],
    [
      "un BOF",
      () =>
        db
          .insert(movieRejection)
          .values({ userId: LEA, tmdbId: 2, rejectedAt: NOW }),
    ],
    ["un instantané", () => db.insert(movieSnapshot).values(aSnapshot(1))],
  ])("refuse deux fois %s", async (_name, insertAgain) => {
    await expect(insertAgain()).rejects.toThrow();
  });

  it("déclare les clés étrangères générées dans la migration", () => {
    const keys = [membership, groupMovie, movieWant, movieRejection].flatMap(
      (table) =>
        getTableConfig(table).foreignKeys.map((key) => {
          const { columns, foreignTable, foreignColumns } = key.reference();
          const to = getTableConfig(foreignTable).name;
          const names = (cols: { name: string }[]) =>
            cols.map((c) => c.name).join(",");
          return `${getTableConfig(table).name}(${names(columns)}) → ${to}(${names(foreignColumns)}) ${key.onDelete ?? "no action"}`;
        }),
    );

    expect(keys.sort()).toEqual([
      "group_movie(added_by) → user(id) set null",
      "group_movie(group_id) → app_group(id) cascade",
      "group_movie(tmdb_id) → movie_snapshot(tmdb_id) no action",
      "group_movie(watched_by) → user(id) set null",
      "membership(group_id) → app_group(id) cascade",
      "membership(user_id) → user(id) cascade",
      "movie_rejection(user_id) → user(id) cascade",
      "movie_want(group_id,tmdb_id) → group_movie(group_id,tmdb_id) cascade",
      "movie_want(user_id) → user(id) cascade",
    ]);
  });
});
