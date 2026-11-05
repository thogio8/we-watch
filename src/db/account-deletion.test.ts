import { and, eq, or, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import { allRows } from "@tests/helpers/rows";
import { createAccount, type Account } from "./account";
import {
  account as accountTable,
  passkey,
  session,
  signupTicketUse,
  user,
  verification,
} from "./auth-schema";
import type { Database } from "./create-database";
import { createDecisions } from "./decisions";
import { createFavorites } from "./favorites";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
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
  // Léa's favourite on the shared list.
  await createFavorites(db).set({
    groupId: shared,
    userId: lea,
    tmdbId: 2,
    on: true,
    now: T0,
  });
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
      or(
        eq(groupMovie.addedBy, userId),
        eq(groupMovie.watchedBy, userId),
        eq(groupMovie.favoriteBy, userId),
      ),
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

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Rows in a stable order: a deletion may reorder what a scan returns. */
const canonical = (tables: Tables): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.map((row) => JSON.stringify(row)).sort(),
    ]),
  );

/** Léa's own rows, and her solo group with everything in it. */
const isLeas = (table: string, row: Row) =>
  row.user_id === lea ||
  row.group_id === solo ||
  (table === "user" && row.id === lea) ||
  (table === "app_group" && row.id === solo);

const formerMember = (value: unknown) => (value === lea ? null : value);

/**
 * The whole database as `before` but without Léa: her rows and solo group
 * gone, and on the lists she shared, « un ancien membre » in her place.
 */
const withoutLea = (before: Tables): Tables =>
  Object.fromEntries(
    Object.entries(before).map(([table, rows]) => [
      table,
      rows
        .filter((row) => !isLeas(table, row))
        .map((row) =>
          table === "group_movie"
            ? {
                ...row,
                added_by: formerMember(row.added_by),
                watched_by: formerMember(row.watched_by),
                favorite_by: formerMember(row.favorite_by),
              }
            : row,
        ),
    ]),
  );

/** Rows that belong to nobody in particular: none of them may move. */
async function unrelatedRows() {
  await db
    .update(group)
    .set({ inviteToken: "invite-shared" })
    .where(eq(group.id, shared));
  await db
    .update(group)
    .set({ inviteToken: "invite-zoes" })
    .where(eq(group.id, zoes));
  // A movie of the pre-accounts list, copied into the shared group.
  await keep(shared, hugo, 8);
  await db
    .update(groupMovie)
    .set({ addedBy: null, addedVia: "legacy" })
    .where(and(eq(groupMovie.groupId, shared), eq(groupMovie.tmdbId, 8)));
  await db.insert(verification).values({
    id: "verification-1",
    identifier: "passkey-challenge",
    value: "challenge",
    expiresAt: new Date(2026, 11, 1),
  });
  await db.insert(signupTicketUse).values({ id: "jti-1", usedAt: T0 });
}

/** Deletes Léa: every other row of the database stays as it was. */
async function expectOnlyLeaGone() {
  await unrelatedRows();
  const before = await allRows(db);

  expect(await account.deleteUser(lea)).toBe(true);

  expect(canonical(await allRows(db))).toEqual(canonical(withoutLea(before)));
}

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
    });
    expect(await movieOf(shared, 4)).toMatchObject({
      addedBy: null,
      watchedBy: hugo,
    });
  });

  it("membre parmi d’autres : ses coups de cœur restent, attribués à un ancien membre", async () => {
    await account.deleteUser(lea);

    expect(await movieOf(shared, 2)).toMatchObject({
      favoriteAt: T0,
      favoriteBy: null,
    });
  });

  it("un « voulu » égaré hors de ses groupes disparaît aussi", async () => {
    await account.deleteUser(lea);

    expect((await wholeGroup(zoes)).wants.map((row) => row.userId)).toEqual([
      zoe,
    ]);
  });

  it("toute la base est identique avant et après, Léa en moins", () =>
    expectOnlyLeaGone());

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

    await expectOnlyLeaGone();

    await nothingLeftOf(lea);
  });

  it("un utilisateur inconnu : false, rien n’est écrit", async () => {
    const before = await allRows(db);

    expect(await account.deleteUser("inconnu")).toBe(false);

    expect(await allRows(db)).toEqual(before);
  });
});
