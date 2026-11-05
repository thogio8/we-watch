import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createGroupList } from "./group-list";
import { groupMovie } from "./group-schema";
import { createGroupWishes, GROUP_WISHES_LIMIT } from "./group-wishes";

const at = (day: number) => new Date(2026, 9, day);

let db: Database;
let decisions: Decisions;
let lea: string;
let hugo: string;
let zoe: string;
let A: string;
let B: string;

const want = (userId: string, tmdbId: number, day = 1, groupId = A) =>
  decisions.swipe({
    groupId,
    userId,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: at(day),
  });
const bof = (userId: string, tmdbId: number, groupId = A) =>
  decisions.swipe({ groupId, userId, tmdbId, decision: "reject" });
const pending = async (userId = lea, groupId = A) =>
  createGroupWishes(db).pending(groupId, userId);
const ids = async (userId = lea) =>
  (await pending(userId)).map((m) => m.tmdbId);

beforeEach(async () => {
  db = await aDatabase();
  decisions = createDecisions(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  zoe = await aUser(db, "Zoé");
  A = await aGroup(db, "A", [lea, hugo, zoe]);
  B = await aGroup(db, "B", [lea, hugo]);
});

describe("la file « le groupe le veut »", () => {
  it("liste un film voulu par un autre membre, avec ses données", async () => {
    await want(hugo, 1);
    expect(await pending()).toEqual([
      { ...aSnapshot(1), wish: { others: ["Hugo"], matched: false } },
    ]);
  });

  it("ne fait pas fuiter un autre groupe", async () => {
    await want(hugo, 1, 1, B);
    expect(await ids()).toEqual([]);
  });

  it("n’y met ni un film vu ni un film écarté", async () => {
    await want(hugo, 1);
    await want(hugo, 2);
    const list = createGroupList(db);
    await list.apply({
      groupId: A,
      userId: hugo,
      action: "mark_watched",
      tmdbId: 1,
      now: at(2),
    });
    await list.apply({
      groupId: A,
      userId: hugo,
      action: "remove",
      tmdbId: 2,
      now: at(2),
    });
    expect(await ids()).toEqual([]);
  });

  it("n’y met pas un film que je veux déjà", async () => {
    await want(hugo, 1);
    await want(lea, 1);
    expect(await ids()).toEqual([]);
  });

  it("n’y met pas un film que j’ai mis en BOF, dans n’importe quel groupe", async () => {
    await want(hugo, 1);
    await want(hugo, 2);
    await bof(lea, 1);
    await bof(lea, 2, B);
    expect(await ids()).toEqual([]);
  });

  it("n’y met pas un film ajouté par la recherche, sans envie", async () => {
    await want(hugo, 1);
    await createDecisions(db).undoSwipe({
      groupId: A,
      userId: hugo,
      tmdbId: 1,
      decision: "keep",
    });
    expect(await ids()).toEqual([]);
  });

  it("classe par nombre d’envies, puis envie la plus récente, puis tmdb_id", async () => {
    await want(hugo, 5, 1);
    await want(hugo, 3, 2);
    await want(hugo, 4, 2);
    await want(hugo, 6, 1);
    await want(zoe, 6, 3);
    await want(zoe, 4, 4);
    await want(zoe, 3, 4);
    await want(zoe, 7, 9);
    expect(await ids()).toEqual([3, 4, 6, 7, 5]);
  });

  it("départage à égalité totale par tmdb_id croissant", async () => {
    await want(hugo, 9, 2);
    await want(hugo, 2, 2);
    expect(await ids()).toEqual([2, 9]);
  });

  it("s’arrête à la limite", async () => {
    for (let id = 1; id <= GROUP_WISHES_LIMIT + 1; id++) await want(hugo, id);
    expect(await pending()).toHaveLength(GROUP_WISHES_LIMIT);
  });

  it("reste vide quand je suis seul dans le groupe", async () => {
    const solo = await aGroup(db, "Solo", [lea]);
    await want(lea, 1, 1, solo);
    expect(await pending(lea, solo)).toEqual([]);
  });

  it("reflète matched_at dans wish.matched", async () => {
    await want(hugo, 1);
    await want(hugo, 2);
    await db
      .update(groupMovie)
      .set({ matchedAt: at(5) })
      .where(and(eq(groupMovie.groupId, A), eq(groupMovie.tmdbId, 2)));
    expect((await pending()).map((m) => [m.tmdbId, m.wish.matched])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("ne met jamais mon prénom dans others, dans l’ordre des envies", async () => {
    await want(zoe, 1, 2);
    await want(hugo, 1, 1);
    expect((await pending())[0]?.wish.others).toEqual(["Hugo", "Zoé"]);
  });
});
