import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { matchOf } from "@tests/helpers/list-world";
import { aSnapshot } from "@tests/helpers/movies";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createGroupList } from "./group-list";
import { createMemberships, type Memberships } from "./membership";

const T0 = new Date(2026, 10, 1);
const T1 = new Date(2026, 10, 2);
const T2 = new Date(2026, 10, 3);
const T3 = new Date(2026, 10, 4);
const FILM = 1;

let db: Database;
let decisions: Decisions;
let memberships: Memberships;
let lea: string;
let hugo: string;
let sam: string;
/** Léa and Hugo. */
let duo: string;

beforeEach(async () => {
  db = await aDatabase();
  decisions = createDecisions(db);
  memberships = createMemberships(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  sam = await aUser(db, "Sam");
  duo = await aGroup(db, "NOUS DEUX", [lea, hugo]);
});

const keep = (userId: string, now: Date, groupId = duo) =>
  decisions.swipe({
    groupId,
    userId,
    tmdbId: FILM,
    decision: "keep",
    snapshot: aSnapshot(FILM),
    now,
  });

const undo = (userId: string, groupId = duo) =>
  decisions.undoSwipe({ groupId, userId, tmdbId: FILM, decision: "keep" });

const match = (groupId = duo) => matchOf(db, groupId, FILM);

/** Léa then Hugo keep the movie: Hugo's swipe makes the match, at T1. */
async function hugoMakesTheMatch() {
  await keep(lea, T0);
  expect(await keep(hugo, T1)).toEqual({ result: "applied", matched: true });
  expect(await match()).toEqual({ at: T1, by: hugo });
}

describe("poser un match", () => {
  it("le match se pose au swipe du dernier membre qui manque, pas avant", async () => {
    const trio = await aGroup(db, "TOUS", [lea, hugo, sam]);

    expect(await keep(lea, T0, trio)).toEqual({
      result: "applied",
      matched: false,
    });
    expect(await keep(hugo, T1, trio)).toEqual({
      result: "applied",
      matched: false,
    });
    expect(await match(trio)).toEqual({ at: null, by: null });
    expect(await keep(sam, T2, trio)).toEqual({
      result: "applied",
      matched: true,
    });

    expect(await match(trio)).toEqual({ at: T2, by: sam });
    expect(await createGroupList(db).counts(trio)).toMatchObject({
      matches: 1,
    });
  });

  it("jamais dans un groupe d’un seul membre", async () => {
    const solo = await aGroup(db, "SOLO", [lea]);

    expect(await keep(lea, T0, solo)).toEqual({
      result: "applied",
      matched: false,
    });
    expect(await match(solo)).toEqual({ at: null, by: null });
  });

  it("jamais sur un film vu ou écarté", async () => {
    const list = createGroupList(db);
    for (const action of ["mark_watched", "remove"] as const) {
      const groupId = await aGroup(db, action, [lea, hugo]);
      await keep(lea, T0, groupId);
      await list.apply({ groupId, userId: lea, action, tmdbId: FILM, now: T1 });

      expect(await keep(hugo, T2, groupId)).toEqual({
        result: "applied",
        matched: false,
      });
      expect(await match(groupId)).toEqual({ at: null, by: null });
    }
  });

  it("swipe répété du même membre : noop, pas de second match", async () => {
    await hugoMakesTheMatch();

    expect(await keep(hugo, T2)).toEqual({ result: "noop", matched: false });
    expect(await keep(lea, T2)).toEqual({ result: "noop", matched: false });
    expect(await match()).toEqual({ at: T1, by: hugo });
  });
});

describe("un match est acquis", () => {
  it("un membre qui rejoint ne retire rien", async () => {
    await hugoMakesTheMatch();

    await memberships.join(duo, sam, T2);
    expect(await match()).toEqual({ at: T1, by: hugo });
    // His wish completes nothing: the match was already made.
    expect(await keep(sam, T3)).toEqual({ result: "applied", matched: false });
    expect(await match()).toEqual({ at: T1, by: hugo });
  });

  it("un membre qui part n’en crée pas", async () => {
    const trio = await aGroup(db, "TOUS", [lea, hugo, sam]);
    await keep(lea, T0, trio);
    await keep(hugo, T1, trio);

    // Sam, the only one who did not want it, leaves: everyone left wants it.
    expect(await memberships.leave(trio, sam)).toBe("left");

    expect(await match(trio)).toEqual({ at: null, by: null });
    // Only a new wish can make a match.
    expect(await keep(hugo, T2, trio)).toEqual({
      result: "noop",
      matched: false,
    });
    expect(await match(trio)).toEqual({ at: null, by: null });
  });

  it("un membre qui part ne le retire pas, ses envies parties", async () => {
    await hugoMakesTheMatch();

    expect(await memberships.leave(duo, hugo)).toBe("left");

    expect(await match()).toEqual({ at: T1, by: hugo });
  });
});

describe("défaire un match", () => {
  it("« ANNULER » juste après le match : plus de match", async () => {
    await hugoMakesTheMatch();

    expect(await undo(hugo)).toBe("applied");

    expect(await match()).toEqual({ at: null, by: null });
  });

  it("« ANNULER » d’un autre membre : le match reste", async () => {
    // Same millisecond: only who made the match tells the swipes apart.
    await keep(lea, T1);
    await keep(hugo, T1);

    expect(await undo(lea)).toBe("applied");

    expect(await match()).toEqual({ at: T1, by: hugo });
  });

  it("quitter puis rejoindre, re-swiper et annuler : l’ancien match reste", async () => {
    await hugoMakesTheMatch();
    await memberships.leave(duo, hugo);
    await memberships.join(duo, hugo, T2);

    expect(await keep(hugo, T3)).toEqual({ result: "applied", matched: false });
    expect(await match()).toEqual({ at: T1, by: hugo });
    expect(await undo(hugo)).toBe("applied");

    expect(await match()).toEqual({ at: T1, by: hugo });
  });

  it("« ANNULER » d’un swipe qui n’avait rien posé : rien ne bouge", async () => {
    await hugoMakesTheMatch();

    expect(await undo(sam)).toBe("noop");

    expect(await match()).toEqual({ at: T1, by: hugo });
  });
});
