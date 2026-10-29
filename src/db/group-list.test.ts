import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot, NETFLIX } from "@tests/helpers/movies";
import { user } from "./auth-schema";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createGroupList, type GroupList } from "./group-list";
import { groupMovie } from "./group-schema";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);
const T2 = new Date(2026, 9, 3);

let db: Database;
let list: GroupList;
let decisions: Decisions;
let lea: string;
let hugo: string;
let groupA: string;
let groupB: string;

beforeEach(async () => {
  db = await aDatabase();
  list = createGroupList(db);
  decisions = createDecisions(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  groupA = await aGroup(db, "A", [lea, hugo]);
  groupB = await aGroup(db, "B", [lea]);
});

const keep = (tmdbId: number, groupId = groupA, userId = lea, now = T0) =>
  decisions.swipe({
    groupId,
    userId,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now,
  });

type Action = Parameters<GroupList["apply"]>[0]["action"];
const act = (action: Action, tmdbId: number, userId = lea, now = T1) =>
  list.apply({ groupId: groupA, userId, action, tmdbId, now });

const search = (tmdbId: number, userId = lea, now = T1) =>
  list.apply({
    groupId: groupA,
    userId,
    action: "search_add",
    tmdbId,
    snapshot: aSnapshot(tmdbId, { title: "Trouvé", providers: [NETFLIX] }),
    now,
  });

const ids = (movies: { tmdbId: number }[]) => movies.map((m) => m.tmdbId);

describe("liste du groupe", () => {
  it("findInList retrouve un film à voir ou vu du groupe, pas un film écarté", async () => {
    await keep(1);
    await keep(2);
    await act("mark_watched", 2);
    await keep(3);
    await act("remove", 3);

    expect(await list.findInList(groupA, 1)).toMatchObject({
      tmdbId: 1,
      status: "to_watch",
      decidedAt: T0,
      addedBy: "Léa",
      wantedBy: ["Léa"],
      watchedBy: null,
      legacy: false,
    });
    expect(await list.findInList(groupA, 2)).toMatchObject({
      status: "watched",
    });
    expect(await list.findInList(groupA, 3)).toBeNull();
    expect(await list.findInList(groupB, 1)).toBeNull();
  });

  it("listByStatus trie par date et ne voit jamais les films d’un autre groupe", async () => {
    await keep(1, groupA, lea, T0);
    await keep(2, groupA, lea, T1);
    await keep(3, groupB, lea, T2);
    await keep(4, groupA);
    await keep(5, groupA);
    await act("mark_watched", 4, lea, T2);
    await act("mark_watched", 5, lea, T1);

    expect(ids(await list.listByStatus(groupA, "to_watch"))).toEqual([2, 1]);
    expect(ids(await list.listByStatus(groupA, "watched"))).toEqual([4, 5]);
    expect(ids(await list.listByStatus(groupB, "to_watch"))).toEqual([3]);
    expect(await list.listByStatus(groupB, "watched")).toEqual([]);
  });

  it("counts compte les films à voir et vus du groupe seulement", async () => {
    await keep(1);
    await keep(2);
    await act("mark_watched", 2);
    await keep(3);
    await act("remove", 3);
    await keep(4, groupB);

    expect(await list.counts(groupA)).toEqual({ toWatch: 1, watched: 1 });
    expect(await list.counts(groupB)).toEqual({ toWatch: 1, watched: 0 });
  });

  it("statusesOf donne le statut dans le groupe, écartés compris", async () => {
    await keep(1);
    await keep(2);
    await act("remove", 2);
    await keep(3, groupB);

    expect(await list.statusesOf(groupA, [])).toEqual(new Map());
    expect(await list.statusesOf(groupA, [1, 2, 3, 4])).toEqual(
      new Map([
        [1, "to_watch"],
        [2, "rejected"],
      ]),
    );
  });

  it("un BOF n’apparaît jamais dans la liste du groupe", async () => {
    await decisions.swipe({
      groupId: groupA,
      userId: hugo,
      tmdbId: 1,
      decision: "reject",
      snapshot: aSnapshot(1),
    });

    expect(await list.findInList(groupA, 1)).toBeNull();
    expect(await list.counts(groupA)).toEqual({ toWatch: 0, watched: 0 });
    expect(await list.statusesOf(groupA, [1])).toEqual(new Map());
  });

  it("search_add ajoute un nouveau film, attribué à qui l’a cherché", async () => {
    expect(await search(1, hugo)).toBe("applied");

    expect(await list.findInList(groupA, 1)).toMatchObject({
      title: "Trouvé",
      providers: [NETFLIX],
      status: "to_watch",
      decidedAt: T1,
      addedBy: "Hugo",
      wantedBy: [],
      legacy: false,
    });
    expect(
      await db
        .select({ via: groupMovie.addedVia })
        .from(groupMovie)
        .where(eq(groupMovie.tmdbId, 1)),
    ).toEqual([{ via: "search" }]);
    expect(await search(1, lea)).toBe("noop");
  });

  it("search_add sur un film écarté le remet à voir et efface le BOF", async () => {
    await keep(1);
    await act("remove", 1, lea, T1);
    await decisions.swipe({
      groupId: groupB,
      userId: hugo,
      tmdbId: 1,
      decision: "reject",
      snapshot: aSnapshot(1),
    });

    expect(await search(1, hugo, T2)).toBe("applied");

    expect(await list.findInList(groupA, 1)).toMatchObject({
      title: "Trouvé",
      status: "to_watch",
      decidedAt: T2,
      addedBy: "Hugo",
    });
    expect(await decisions.deckExclusions(groupB, hugo)).toEqual(new Set());
  });

  it("refuse d’ajouter un film inconnu sans instantané", async () => {
    await expect(act("search_add", 1)).rejects.toThrow(
      "apply(search_add): snapshot required for new movie 1",
    );
  });

  it("mark_watched pose la date et l’auteur, unwatch les efface", async () => {
    await keep(1);

    expect(await act("mark_watched", 1, hugo, T1)).toBe("applied");
    expect(await list.findInList(groupA, 1)).toMatchObject({
      status: "watched",
      decidedAt: T0,
      watchedAt: T1,
      watchedBy: "Hugo",
    });

    expect(await act("unwatch", 1, lea, T2)).toBe("applied");
    expect(await list.findInList(groupA, 1)).toMatchObject({
      status: "to_watch",
      decidedAt: T0,
      watchedAt: null,
      watchedBy: null,
    });
  });

  it("remove écarte le film pour le groupe ; une transition impossible ne fait rien", async () => {
    await keep(1);

    expect(await act("remove", 1)).toBe("applied");
    expect(await list.statusesOf(groupA, [1])).toEqual(
      new Map([[1, "rejected"]]),
    );
    expect(await act("remove", 1)).toBe("noop");
    expect(await act("mark_watched", 2)).toBe("noop");
    expect(await act("unwatch", 1)).toBe("noop");
  });

  it("attribution : un compte supprimé n’est plus nommé, sans être un film copié", async () => {
    await keep(1, groupA, lea, T0);
    await keep(1, groupA, hugo, T1);
    await act("mark_watched", 1, lea);

    await db.delete(user).where(eq(user.id, lea));

    expect(await list.findInList(groupA, 1)).toMatchObject({
      addedBy: null,
      watchedBy: null,
      wantedBy: ["Hugo"],
      legacy: false,
    });
  });

  it("signale un film copié de l’ancienne liste", async () => {
    await keep(1);
    await db.update(groupMovie).set({ legacy: true, addedBy: null });

    expect(await list.findInList(groupA, 1)).toMatchObject({
      addedBy: null,
      legacy: true,
    });
  });
});
