import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot, NETFLIX } from "@tests/helpers/movies";
import { FORMER_MEMBER, watchedLine } from "@/domain/attribution";
import type { Movie } from "@/domain/movie";
import { formatShortDate } from "@/domain/time";
import { user } from "./auth-schema";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createGroupList, type GroupList } from "./group-list";
import { groupMovie } from "./group-schema";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);
const T2 = new Date(2026, 9, 3);
const T3 = new Date(2026, 9, 4);

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

// Writes the columns directly: the write repository comes later.
const favorite = (
  tmdbId: number,
  userId: string | null,
  at: Date,
  groupId = groupA,
) =>
  db
    .update(groupMovie)
    .set({ favoriteAt: at, favoriteBy: userId })
    .where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)));

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

    expect(await list.counts(groupA)).toEqual({
      toWatch: 1,
      watched: 1,
      favorites: 0,
    });
    expect(await list.counts(groupB)).toEqual({
      toWatch: 1,
      watched: 0,
      favorites: 0,
    });
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

  it("listByStatus met les coups de cœur en tête, le plus récent d’abord, puis le reste par date", async () => {
    await keep(1, groupA, lea, T0);
    await keep(2, groupA, lea, T1);
    await keep(3, groupA, lea, T2);
    await keep(4, groupA, lea, T3);
    await favorite(1, hugo, T3);
    await favorite(2, lea, T2);

    const movies = await list.listByStatus(groupA, "to_watch");
    // Favourites by the date they were marked, not the date they were added.
    expect(ids(movies)).toEqual([1, 2, 4, 3]);
    expect(movies[0]).toMatchObject({ favoriteAt: T3, favoriteBy: "Hugo" });
    expect(movies[2]).toMatchObject({ favoriteAt: null, favoriteBy: null });
  });

  it("un film vu ou écarté n’est jamais coup de cœur, même si ses colonnes sont restées remplies", async () => {
    await keep(1);
    await keep(2);
    await favorite(1, hugo, T1);
    await favorite(2, hugo, T1);
    await db
      .update(groupMovie)
      .set({ status: "watched", watchedAt: T2 })
      .where(eq(groupMovie.tmdbId, 1));
    await db
      .update(groupMovie)
      .set({ status: "rejected" })
      .where(eq(groupMovie.tmdbId, 2));

    expect(await list.findInList(groupA, 1)).toMatchObject({
      status: "watched",
      favoriteAt: null,
      favoriteBy: null,
    });
    expect((await list.counts(groupA)).favorites).toBe(0);
  });

  it("counts compte les coups de cœur à voir du groupe seulement", async () => {
    await keep(1);
    await keep(2);
    await keep(3, groupB);
    await favorite(1, lea, T1);
    await favorite(3, lea, T1, groupB);

    expect(await list.counts(groupA)).toEqual({
      toWatch: 2,
      watched: 0,
      favorites: 1,
    });
  });

  it("coup de cœur d’un compte supprimé : la date reste, sans prénom", async () => {
    await keep(1);
    await favorite(1, hugo, T1);

    await db.delete(user).where(eq(user.id, hugo));

    expect(await list.findInList(groupA, 1)).toMatchObject({
      favoriteAt: T1,
      favoriteBy: null,
    });
  });

  it("un BOF n’apparaît jamais dans la liste du groupe", async () => {
    await decisions.swipe({
      groupId: groupA,
      userId: hugo,
      tmdbId: 1,
      decision: "reject",
    });

    expect(await list.findInList(groupA, 1)).toBeNull();
    expect(await list.counts(groupA)).toEqual({
      toWatch: 0,
      watched: 0,
      favorites: 0,
    });
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
    });

    expect(await search(1, hugo, T2)).toBe("applied");

    expect(await list.findInList(groupA, 1)).toMatchObject({
      title: "Trouvé",
      status: "to_watch",
      decidedAt: T2,
      addedBy: "Hugo",
      wantedBy: [],
    });
    expect(await decisions.deckExclusions(groupB, hugo)).toEqual(new Set());
  });

  it("search_add efface toujours le BOF de qui cherche, même sur un film déjà listé", async () => {
    await decisions.swipe({
      groupId: groupB,
      userId: hugo,
      tmdbId: 1,
      decision: "reject",
    });
    await keep(1);

    expect(await search(1, hugo, T2)).toBe("applied");

    expect(await list.findInList(groupA, 1)).toMatchObject({
      status: "to_watch",
      decidedAt: T0,
      addedBy: "Léa",
    });
    expect(await decisions.deckExclusions(groupB, hugo)).toEqual(new Set());
    expect(await search(1, hugo, T2)).toBe("noop");
  });

  it("search_add d’un nouveau film qu’un autre membre vient d’ajouter : rien de plus", async () => {
    // Hugo's add lands between Léa's read and her insert (the in-memory
    // client has one connection, so the race is staged with a trigger).
    await db.run(
      sql.raw(`
      CREATE TEMP TRIGGER hugo_adds_first AFTER INSERT ON movie_snapshot
      BEGIN
        INSERT INTO group_movie (group_id, tmdb_id, status, decided_at, added_by, added_via)
        VALUES ('${groupA}', NEW.tmdb_id, 'to_watch', 0, '${hugo}', 'search');
      END`),
    );

    expect(await search(1, lea)).toBe("noop");
    expect(await list.findInList(groupA, 1)).toMatchObject({
      addedBy: "Hugo",
    });
  });

  it("wantedBy ne compte que les souhaits du groupe", async () => {
    await keep(1, groupA, lea);
    await aGroup(db, "C", [hugo]).then((groupC) => keep(1, groupC, hugo));

    expect(await list.findInList(groupA, 1)).toMatchObject({
      wantedBy: ["Léa"],
    });
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

  const rawFavorite = async (tmdbId: number) =>
    (
      await db
        .select({ at: groupMovie.favoriteAt, by: groupMovie.favoriteBy })
        .from(groupMovie)
        .where(eq(groupMovie.tmdbId, tmdbId))
    )[0];

  it.each(["mark_watched", "remove"] as const)(
    "%s efface le coup de cœur",
    async (action) => {
      await keep(1);
      await favorite(1, hugo, T1);

      expect(await act(action, 1, lea, T2)).toBe("applied");

      expect(await rawFavorite(1)).toEqual({ at: null, by: null });
    },
  );

  it("unwatch ramène le film à voir sans coup de cœur, même si les colonnes étaient restées remplies", async () => {
    await keep(1);
    await act("mark_watched", 1);
    await favorite(1, hugo, T2);

    expect(await act("unwatch", 1, lea, T3)).toBe("applied");

    expect(await rawFavorite(1)).toEqual({ at: null, by: null });
    expect(await list.findInList(groupA, 1)).toMatchObject({
      status: "to_watch",
      favoriteAt: null,
    });
  });

  it("search_add d’un film écarté le remet à voir sans coup de cœur", async () => {
    await keep(1);
    await act("remove", 1);
    await favorite(1, hugo, T2);

    expect(await search(1, lea, T3)).toBe("applied");

    expect(await rawFavorite(1)).toEqual({ at: null, by: null });
    expect((await list.counts(groupA)).favorites).toBe(0);
  });

  it("search_add d’un film déjà à voir garde son coup de cœur", async () => {
    await keep(1);
    await favorite(1, hugo, T1);

    await search(1, lea, T2);

    expect(await rawFavorite(1)).toEqual({ at: T1, by: hugo });
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

  describe("film copié de l’ancienne liste", () => {
    // What migrations 0006 and 0007 leave: no author, and a movie already
    // watched before the accounts has nobody to name.
    const copied = (watchedAt: Date | null) =>
      db.update(groupMovie).set({
        status: watchedAt === null ? "to_watch" : "watched",
        watchedAt,
        addedBy: null,
        addedVia: "legacy",
        legacy: true,
        watchedLegacy: watchedAt !== null,
      });
    const line = async (tmdbId: number) =>
      watchedLine(
        (await list.findInList(groupA, tmdbId)) as Movie,
        formatShortDate,
      );

    it("vu avant les comptes : « vu le … », sans marqueur", async () => {
      await keep(1);
      await copied(T1);

      expect(await line(1)).toBe("vu le 02/10");
    });

    it("marqué ensuite par Hugo, dont le compte est supprimé : « un ancien membre »", async () => {
      await keep(1);
      await copied(null);
      await act("mark_watched", 1, hugo, T2);

      await db.delete(user).where(eq(user.id, hugo));

      expect(await line(1)).toBe(`vu le 03/10 · marqué par ${FORMER_MEMBER}`);
      expect(await list.findInList(groupA, 1)).toMatchObject({ legacy: true });
    });

    it("revu après « pas vu » : le marqueur compte de nouveau", async () => {
      await keep(1);
      await copied(T1);
      await act("unwatch", 1, lea, T2);
      await act("mark_watched", 1, hugo, T2);

      expect(await line(1)).toBe("vu le 03/10 · marqué par Hugo");
    });
  });
});
