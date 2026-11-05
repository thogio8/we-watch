import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decideSwipe, loadMoreCards } from "@/features/swipe/actions";
import { getDecisions } from "@/server/container";
import { setTmdbDown } from "../fake-tmdb/handler";
import { startServerStack } from "../helpers/functional";
import { aGroup, aUser } from "../helpers/groups";
import { aSnapshot } from "../helpers/movies";

vi.mock("@/server/session");
vi.mock("next/cache");

const WHIPLASH = 244786;

let stack: ReturnType<typeof startServerStack>;
let groupId = "";
let hugo = "";

beforeAll(async () => {
  stack = startServerStack();
  await stack;
});

/** Léa (the session) and Hugo share a group where Hugo wants Whiplash. */
beforeEach(async () => {
  setTmdbDown(false);
  const { db, reset } = await stack;
  await reset();
  hugo = await aUser(db, "Hugo");
  groupId = await aGroup(db, "NOUS DEUX", ["user-1", hugo]);
  await getDecisions().swipe({
    groupId,
    userId: hugo,
    tmdbId: WHIPLASH,
    decision: "keep",
    snapshot: aSnapshot(WHIPLASH, { title: "Whiplash" }),
  });
});

describe("swiper un film que l’autre veut (fonctionnel)", () => {
  it("le dernier ♥ fait le match, une seule fois", async () => {
    await expect(decideSwipe(groupId, WHIPLASH, "keep")).resolves.toEqual({
      result: "applied",
      matched: true,
    });
    await expect(decideSwipe(groupId, WHIPLASH, "keep")).resolves.toEqual({
      result: "noop",
      matched: false,
    });
  });

  it("♥ sur un film déjà listé réussit, TMDB coupé", async () => {
    setTmdbDown(true);

    await expect(decideSwipe(groupId, WHIPLASH, "keep")).resolves.toMatchObject(
      { result: "applied", matched: true },
    );
  });

  it("la file du groupe ouvre le deck, avec qui le veut", async () => {
    const result = await loadMoreCards(groupId, "top", 1);

    // Whiplash first, once (the theme leaves out the group's list), then the
    // four other films of the catalogue, none of them wanted.
    expect(result).toEqual({
      ok: true,
      batch: {
        nextPage: null,
        cards: [
          expect.objectContaining({
            tmdbId: WHIPLASH,
            wish: { others: ["Hugo"], matched: false },
          }),
          ...Array(4).fill(expect.not.objectContaining({ wish: {} })),
        ],
      },
    });
  });

  it("TMDB en panne : la file s’affiche quand même", async () => {
    setTmdbDown(true);

    const result = await loadMoreCards(groupId, "top", 1);

    expect(result).toMatchObject({
      ok: true,
      batch: { nextPage: 1, cards: [{ tmdbId: WHIPLASH }] },
    });
  });
});
