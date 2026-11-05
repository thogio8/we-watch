import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aUser } from "@tests/helpers/groups";
import { aListWorld, matchOf } from "@tests/helpers/list-world";
import { aSnapshot } from "@tests/helpers/movies";
import { createFavorites } from "./favorites";
import { groupMovie } from "./group-schema";
import { createMemberships } from "./membership";
import type { MovieAction } from "@/domain/transitions";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);

let w: Awaited<ReturnType<typeof aListWorld>>;
beforeEach(async () => {
  w = await aListWorld();
});

const keep = (tmdbId: number, groupId = w.groupA) =>
  w.decisions.swipe({
    groupId,
    userId: w.lea,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: T0,
  });

// Writes the columns directly: the match write comes later.
const set = (
  tmdbId: number,
  values: Partial<typeof groupMovie.$inferInsert>,
  groupId = w.groupA,
) =>
  w.db
    .update(groupMovie)
    .set(values)
    .where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)));

describe("liste du groupe : matchs et taille", () => {
  it("findInList et listByStatus rendent matchedAt et la taille du groupe", async () => {
    await keep(1);
    await keep(2);
    await set(1, { matchedAt: T1, matchedBy: w.hugo });

    expect(await w.list.findInList(w.groupA, 1)).toMatchObject({
      matchedAt: T1,
      groupSize: 2,
    });
    const movies = await w.list.listByStatus(w.groupA, "to_watch");
    const read = movies
      .map((m) => [m.tmdbId, m.matchedAt, m.groupSize])
      .sort(([a], [b]) => Number(a) - Number(b));
    expect(read).toEqual([
      [1, T1, 2],
      [2, null, 2],
    ]);
  });

  it("la taille suit les arrivées dans le groupe", async () => {
    await keep(1);
    const sam = await aUser(w.db, "Sam");
    await createMemberships(w.db).join(w.groupA, sam);

    expect(await w.list.findInList(w.groupA, 1)).toMatchObject({
      groupSize: 3,
    });
  });

  it("un film vu garde son match, un film écarté sort de la liste", async () => {
    await keep(1);
    await keep(2);
    await set(1, { matchedAt: T1, status: "watched", watchedAt: T1 });
    await set(2, { matchedAt: T1, status: "rejected" });

    expect(await w.list.findInList(w.groupA, 1)).toMatchObject({
      matchedAt: T1,
    });
    expect(await w.list.findInList(w.groupA, 2)).toBeNull();
  });

  it("counts compte les matchs à voir de ce groupe, ni les vus ni ceux d’un autre groupe", async () => {
    await keep(1);
    await keep(2);
    await keep(3);
    await keep(4, w.groupB);
    await set(1, { matchedAt: T1 });
    await set(2, { matchedAt: T1, status: "watched", watchedAt: T1 });
    await set(4, { matchedAt: T1 }, w.groupB);

    expect(await w.list.counts(w.groupA)).toEqual({
      toWatch: 2,
      watched: 1,
      favorites: 0,
      matches: 1,
    });
    expect((await w.list.counts(w.groupB)).matches).toBe(1);
  });
});

const T2 = new Date(2026, 9, 3);

/** Hugo keeps a movie Léa kept: his swipe makes the match, at T1. */
const hugoKeeps = (tmdbId = 1) =>
  w.decisions.swipe({
    groupId: w.groupA,
    userId: w.hugo,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: T1,
  });

async function aMatch() {
  await keep(1);
  expect(await hugoKeeps()).toEqual({ result: "applied", matched: true });
}

const act = (action: MovieAction) =>
  w.list.apply({
    groupId: w.groupA,
    userId: w.lea,
    action,
    tmdbId: 1,
    snapshot: aSnapshot(1),
    now: T2,
  });

const favorite = (on: boolean, tmdbId = 1) =>
  createFavorites(w.db).set({
    groupId: w.groupA,
    userId: w.lea,
    tmdbId,
    on,
    now: T2,
  });

const match = () => matchOf(w.db, w.groupA, 1);

describe("liste du groupe : ce que les transitions font d’un match", () => {
  it("écarté puis rajouté par la recherche : plus de match", async () => {
    await aMatch();
    await act("remove");

    expect(await act("search_add")).toBe("applied");

    expect(await match()).toEqual({ at: null, by: null });
    expect(await w.list.findInList(w.groupA, 1)).toMatchObject({
      matchedAt: null,
      wantedBy: [],
    });
  });

  it("vu puis « ↺ À VOIR » : le match reste", async () => {
    await aMatch();

    await act("mark_watched");
    expect(await match()).toEqual({ at: T1, by: w.hugo });
    await act("unwatch");

    expect(await match()).toEqual({ at: T1, by: w.hugo });
    expect((await w.list.counts(w.groupA)).matches).toBe(1);
  });

  it("un coup de cœur ne change rien au match, et inversement", async () => {
    await aMatch();
    expect(await favorite(true)).toBe("applied");
    expect(await match()).toEqual({ at: T1, by: w.hugo });
    expect(await favorite(false)).toBe("applied");
    expect(await match()).toEqual({ at: T1, by: w.hugo });

    // A favourite first, then the match: both stay.
    await keep(2);
    expect(await favorite(true, 2)).toBe("applied");
    expect(await hugoKeeps(2)).toEqual({ result: "applied", matched: true });
    expect(await w.list.findInList(w.groupA, 2)).toMatchObject({
      matchedAt: T1,
      favoriteAt: T2,
    });
  });
});
