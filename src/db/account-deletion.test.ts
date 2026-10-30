import { and, eq, or, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import { allRows } from "@tests/helpers/rows";
import { createAccount, type Account } from "./account";
import { account as accountTable, passkey, session, user } from "./auth-schema";
import type { Database } from "./create-database";
import { createDecisions } from "./decisions";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";

const T0 = new Date(2026, 9, 1);

let db: Database;
let account: Account;
let lea: string;
let hugo: string;
let zoe: string;
/** Léa alone. */
let solo: string;
/** Léa and Hugo. */
let shared: string;
/** Hugo alone: never touched. */
let hugos: string;
/** Zoé alone, where a stray « voulu » of Léa's lies (no membership). */
let zoes: string;

async function keep(groupId: string, userId: string, tmdbId: number) {
  await createDecisions(db).swipe({
    groupId,
    userId,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: T0,
  });
}

async function bof(userId: string, tmdbId: number) {
  await createDecisions(db).swipe({
    groupId: shared,
    userId,
    tmdbId,
    decision: "reject",
    now: T0,
  });
}

async function markWatched(groupId: string, tmdbId: number, by: string) {
  await db
    .update(groupMovie)
    .set({ status: "watched", watchedAt: T0, watchedBy: by })
    .where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)));
}

/** A passkey, a session and a Better Auth account row of `userId`. */
async function signInRows(userId: string) {
  await db.insert(passkey).values({
    id: `passkey-${userId}`,
    userId,
    publicKey: "key",
    credentialID: `credential-${userId}`,
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
  });
  await db.insert(session).values({
    id: `session-${userId}`,
    token: `token-${userId}`,
    userId,
    expiresAt: new Date(2026, 11, 1),
    updatedAt: T0,
  });
  await db.insert(accountTable).values({
    id: `account-${userId}`,
    accountId: userId,
    providerId: "passkey",
    userId,
    updatedAt: T0,
  });
}

beforeEach(async () => {
  db = await aDatabase();
  account = createAccount(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  zoe = await aUser(db, "Zoé");
  solo = await aGroup(db, "SOLO", [lea]);
  shared = await aGroup(db, "NOUS DEUX", [lea, hugo]);
  hugos = await aGroup(db, "HUGO", [hugo]);
  zoes = await aGroup(db, "ZOÉ", [zoe]);

  await keep(solo, lea, 1);
  await keep(shared, lea, 2);
  await keep(shared, hugo, 2);
  await keep(shared, hugo, 3);
  await markWatched(shared, 3, lea);
  await keep(shared, lea, 4);
  await markWatched(shared, 4, hugo);
  await keep(hugos, hugo, 5);
  await markWatched(hugos, 5, hugo);
  await keep(zoes, zoe, 6);
  await db
    .insert(movieWant)
    .values({ groupId: zoes, tmdbId: 6, userId: lea, wantedAt: T0 });
  await bof(lea, 7);
  await bof(hugo, 7);
  for (const id of [lea, hugo, zoe]) {
    await signInRows(id);
  }
});

/** Every row naming `userId`, in every table. */
const rowsNaming = async (userId: string) => ({
  user: await db.select().from(user).where(eq(user.id, userId)),
  membership: await db
    .select()
    .from(membership)
    .where(eq(membership.userId, userId)),
  movieWant: await db
    .select()
    .from(movieWant)
    .where(eq(movieWant.userId, userId)),
  movieRejection: await db
    .select()
    .from(movieRejection)
    .where(eq(movieRejection.userId, userId)),
  passkey: await db.select().from(passkey).where(eq(passkey.userId, userId)),
  session: await db.select().from(session).where(eq(session.userId, userId)),
  account: await db
    .select()
    .from(accountTable)
    .where(eq(accountTable.userId, userId)),
  movies: await db
    .select()
    .from(groupMovie)
    .where(
      or(eq(groupMovie.addedBy, userId), eq(groupMovie.watchedBy, userId)),
    ),
});

/** A group and everything in it. */
const wholeGroup = async (groupId: string) => ({
  group: await db.select().from(group).where(eq(group.id, groupId)),
  membership: await db
    .select()
    .from(membership)
    .where(eq(membership.groupId, groupId)),
  movies: await db
    .select()
    .from(groupMovie)
    .where(eq(groupMovie.groupId, groupId)),
  wants: await db
    .select()
    .from(movieWant)
    .where(eq(movieWant.groupId, groupId)),
});

type Movie = typeof groupMovie.$inferSelect;
/** What Léa's deletion changes in a movie row: her name, on the shared list. */
const asFormerMember = (row: Movie): Movie => ({
  ...row,
  addedBy: row.addedBy === lea ? null : row.addedBy,
  watchedBy: row.watchedBy === lea ? null : row.watchedBy,
});

/** Others' data; in their movie rows, Léa already « un ancien membre ». */
const othersData = async () => ({
  hugo: await rowsNaming(hugo).then((rows) => ({
    ...rows,
    movies: rows.movies.map(asFormerMember),
  })),
  zoe: await rowsNaming(zoe),
  hugos: await wholeGroup(hugos),
  snapshots: await db.select().from(movieSnapshot),
});

const nothingLeftOf = async (userId: string) =>
  expect(Object.values(await rowsNaming(userId)).flat()).toEqual([]);

const movieOf = async (groupId: string, tmdbId: number) =>
  (
    await db
      .select()
      .from(groupMovie)
      .where(
        and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)),
      )
  )[0];

describe("supprimer un compte", () => {
  it("rien ne reste de l’utilisateur : appartenances, voulus, BOF, passkeys, sessions, comptes", async () => {
    expect(await account.deleteUser(lea)).toBe(true);

    await nothingLeftOf(lea);
  });

  it("dernier membre d’un groupe : le groupe disparaît avec sa liste", async () => {
    await account.deleteUser(lea);

    expect(await wholeGroup(solo)).toEqual({
      group: [],
      membership: [],
      movies: [],
      wants: [],
    });
  });

  it("membre parmi d’autres : le groupe reste, ses films passent à « un ancien membre »", async () => {
    await account.deleteUser(lea);

    const after = await wholeGroup(shared);
    expect(after.group).toHaveLength(1);
    expect(after.membership.map((row) => row.userId)).toEqual([hugo]);
    expect(after.wants.map((row) => [row.tmdbId, row.userId])).toEqual([
      [2, hugo],
      [3, hugo],
    ]);
    expect(await movieOf(shared, 2)).toMatchObject({ addedBy: null });
    expect(await movieOf(shared, 3)).toMatchObject({
      addedBy: hugo,
      watchedBy: null,
      watchedLegacy: false,
    });
    expect(await movieOf(shared, 4)).toMatchObject({
      addedBy: null,
      watchedBy: hugo,
    });
  });

  it("un « voulu » égaré hors de ses groupes disparaît aussi", async () => {
    await account.deleteUser(lea);

    expect((await wholeGroup(zoes)).wants.map((row) => row.userId)).toEqual([
      zoe,
    ]);
  });

  it("les données des autres sont identiques avant et après", async () => {
    const before = await othersData();

    await account.deleteUser(lea);

    expect(await othersData()).toEqual(before);
  });

  it("une erreur au milieu de la transaction annule tout", async () => {
    // Fails on the very last statement: everything before it is undone.
    await db.run(
      sql.raw(`
        CREATE TEMP TRIGGER user_stays BEFORE DELETE ON user
        BEGIN SELECT RAISE(ABORT, 'user stays'); END`),
    );
    const before = await allRows(db);

    await expect(account.deleteUser(lea)).rejects.toThrow();

    expect(await allRows(db)).toEqual(before);
  });

  it("supprime tout sans compter sur les clés étrangères", async () => {
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    const before = await othersData();

    await account.deleteUser(lea);

    await nothingLeftOf(lea);
    expect((await wholeGroup(solo)).movies).toEqual([]);
    expect((await wholeGroup(solo)).group).toEqual([]);
    expect(await othersData()).toEqual(before);
  });

  it("un utilisateur inconnu : false, rien n’est écrit", async () => {
    const before = await allRows(db);

    expect(await account.deleteUser("inconnu")).toBe(false);

    expect(await allRows(db)).toEqual(before);
  });
});
