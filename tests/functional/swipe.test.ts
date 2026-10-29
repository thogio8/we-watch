import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMoviesRepository } from "@/server/container";
import {
  decideSwipe,
  loadMoreCards,
  undoSwipe,
} from "@/features/swipe/actions";
import { setTmdbDown } from "../fake-tmdb/handler";
import { startServerStack } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const WHIPLASH = 244786;
const CHIHIRO = 129;

let reset: () => Promise<void>;
beforeAll(async () => ({ reset } = await startServerStack()));
beforeEach(async () => {
  await reset();
  setTmdbDown(false);
});

async function deckIds() {
  const result = await loadMoreCards("top", 1);
  if (!result.ok) throw new Error("TMDB down");
  return result.batch.cards.map((card) => card.tmdbId);
}

describe("swiper (fonctionnel)", () => {
  it("le deck propose le catalogue TMDB, fiches complètes", async () => {
    const result = await loadMoreCards("top", 1);

    expect(result).toMatchObject({ ok: true, batch: { nextPage: null } });
    if (!result.ok) return;
    expect(result.batch.cards).toHaveLength(5);
    expect(result.batch.cards[0]).toMatchObject({
      tmdbId: WHIPLASH,
      title: "Whiplash",
      releaseYear: 2014,
      runtimeMinutes: 107,
      trailerKey: "7d_jQycdQGo",
    });
  });

  it("♥ range le film dans « à voir » et le retire du deck", async () => {
    await expect(decideSwipe(WHIPLASH, "keep")).resolves.toBe("applied");

    const toWatch = await getMoviesRepository().listByStatus("to_watch");
    expect(toWatch.map((m) => m.title)).toEqual(["Whiplash"]);
    expect(await deckIds()).not.toContain(WHIPLASH);
  });

  it("✕ refuse le film : ni dans la liste, ni dans le deck", async () => {
    await decideSwipe(CHIHIRO, "reject");

    expect(await getMoviesRepository().counts()).toEqual({
      toWatch: 0,
      watched: 0,
    });
    expect(await deckIds()).not.toContain(CHIHIRO);
  });

  it("la première décision gagne (l'autre téléphone ne l'écrase pas)", async () => {
    await decideSwipe(WHIPLASH, "keep");

    await expect(decideSwipe(WHIPLASH, "reject")).resolves.toBe("noop");
    expect(await getMoviesRepository().counts()).toMatchObject({ toWatch: 1 });
  });

  it("↺ ANNULER efface la décision : la carte revient dans le deck", async () => {
    await decideSwipe(WHIPLASH, "keep");

    await expect(undoSwipe(WHIPLASH, "keep")).resolves.toBe("applied");
    expect(await deckIds()).toContain(WHIPLASH);
    expect(await getMoviesRepository().counts()).toMatchObject({ toWatch: 0 });
  });

  it("TMDB en panne : le deck répond { ok: false } sans planter", async () => {
    setTmdbDown(true);

    await expect(loadMoreCards("top", 1)).resolves.toEqual({ ok: false });
  });
});
