import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import { allRows } from "@tests/helpers/rows";
import type { Database } from "./create-database";
import { createDecisions } from "./decisions";
import { createFavorites, type Favorites } from "./favorites";
import { createGroupList, type GroupList } from "./group-list";
import { groupMovie } from "./group-schema";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);
const T2 = new Date(2026, 9, 3);

let db: Database;
let favorites: Favorites;
let list: GroupList;
let lea: string;
let hugo: string;
let A: string;
let B: string;

const keep = (tmdbId: number, groupId = A) =>
  createDecisions(db).swipe({
    groupId,
    userId: lea,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: T0,
  });

const act = (action: "mark_watched" | "remove", tmdbId: number) =>
  list.apply({ groupId: A, userId: lea, action, tmdbId, now: T1 });

const rawRow = async (groupId: string, tmdbId: number) =>
  (
    await db
      .select({ at: groupMovie.favoriteAt, by: groupMovie.favoriteBy })
      .from(groupMovie)
      .where(
        and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)),
      )
  )[0];

beforeEach(async () => {
  db = await aDatabase();
  favorites = createFavorites(db);
  list = createGroupList(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  A = await aGroup(db, "A", [lea, hugo]);
  B = await aGroup(db, "B", [lea]);
  await keep(1);
});

describe("coups de cœur en base", () => {
  it("poser : coup de cœur de qui l’a posé, à cette date", async () => {
    expect(
      await favorites.set({
        groupId: A,
        userId: lea,
        tmdbId: 1,
        on: true,
        now: T1,
      }),
    ).toBe("applied");
    expect(await list.findInList(A, 1)).toMatchObject({
      favoriteAt: T1,
      favoriteBy: "Léa",
    });
  });

  it("poser sans date : maintenant", async () => {
    const before = Date.now();
    await favorites.set({ groupId: A, userId: lea, tmdbId: 1, on: true });

    const at = (await rawRow(A, 1))?.at?.getTime() ?? 0;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it("re-poser, même par un autre : noop, l’auteur et la date restent", async () => {
    await favorites.set({
      groupId: A,
      userId: lea,
      tmdbId: 1,
      on: true,
      now: T1,
    });

    expect(
      await favorites.set({
        groupId: A,
        userId: hugo,
        tmdbId: 1,
        on: true,
        now: T2,
      }),
    ).toBe("noop");
    expect(await list.findInList(A, 1)).toMatchObject({
      favoriteAt: T1,
      favoriteBy: "Léa",
    });
  });

  it("enlever efface les deux colonnes ; enlever encore : noop", async () => {
    await favorites.set({
      groupId: A,
      userId: lea,
      tmdbId: 1,
      on: true,
      now: T1,
    });

    expect(
      await favorites.set({ groupId: A, userId: hugo, tmdbId: 1, on: false }),
    ).toBe("applied");
    expect(await rawRow(A, 1)).toEqual({ at: null, by: null });
    expect(
      await favorites.set({ groupId: A, userId: hugo, tmdbId: 1, on: false }),
    ).toBe("noop");
  });

  it("un film vu, écarté, absent ou d’un autre groupe : noop, rien n’est écrit", async () => {
    await keep(2);
    await act("mark_watched", 2);
    await keep(3);
    await act("remove", 3);
    const before = await allRows(db);

    for (const [groupId, tmdbId] of [
      [A, 2],
      [A, 3],
      [A, 999],
      [B, 1],
    ] as const) {
      for (const on of [true, false]) {
        expect(
          await favorites.set({ groupId, userId: lea, tmdbId, on, now: T1 }),
        ).toBe("noop");
      }
    }

    expect(await allRows(db)).toEqual(before);
  });

  it("enlever efface aussi des colonnes restées remplies sur un film vu", async () => {
    await keep(2);
    await act("mark_watched", 2);
    await db
      .update(groupMovie)
      .set({ favoriteAt: T1, favoriteBy: hugo })
      .where(eq(groupMovie.tmdbId, 2));

    expect(
      await favorites.set({ groupId: A, userId: lea, tmdbId: 2, on: false }),
    ).toBe("applied");
    expect(await rawRow(A, 2)).toEqual({ at: null, by: null });
  });

  it("deux poses simultanées : une seule « applied », un seul auteur", async () => {
    const results = await Promise.all([
      favorites.set({ groupId: A, userId: lea, tmdbId: 1, on: true, now: T1 }),
      favorites.set({ groupId: A, userId: hugo, tmdbId: 1, on: true, now: T2 }),
    ]);

    expect(results.toSorted()).toEqual(["applied", "noop"]);
    expect(await rawRow(A, 1)).toEqual({ at: T1, by: lea });
  });
});
