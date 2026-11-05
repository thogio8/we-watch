import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aUser } from "@tests/helpers/groups";
import { aListWorld } from "@tests/helpers/list-world";
import { aSnapshot } from "@tests/helpers/movies";
import { groupMovie } from "./group-schema";
import { createMemberships } from "./membership";

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
