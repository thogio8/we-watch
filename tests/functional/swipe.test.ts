import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGroupList } from "@/server/container";
import {
  decideSwipe,
  loadMoreCards,
  undoSwipe,
} from "@/features/swipe/actions";
import { setTmdbDown } from "../fake-tmdb/handler";
import { withLeasGroup } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const WHIPLASH = 244786;
const CHIHIRO = 129;

const mine = withLeasGroup();
beforeEach(() => setTmdbDown(false));

const counts = () => getGroupList().counts(mine.id);

async function deckIds() {
  const result = await loadMoreCards(mine.id, "top", 1);
  if (!result.ok) throw new Error("TMDB down");
  return result.batch.cards.map((card) => card.tmdbId);
}

describe("swiper (fonctionnel)", () => {
  it("le deck propose le catalogue TMDB, fiches complètes", async () => {
    const result = await loadMoreCards(mine.id, "top", 1);

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
    await expect(decideSwipe(mine.id, WHIPLASH, "keep")).resolves.toBe(
      "applied",
    );

    const toWatch = await getGroupList().listByStatus(mine.id, "to_watch");
    expect(toWatch.map((m) => m.title)).toEqual(["Whiplash"]);
    expect(await deckIds()).not.toContain(WHIPLASH);
  });

  it("✕ BOF : ni dans la liste, ni dans mon deck", async () => {
    await decideSwipe(mine.id, CHIHIRO, "reject");

    expect(await counts()).toEqual({
      toWatch: 0,
      watched: 0,
      favorites: 0,
    });
    expect(await deckIds()).not.toContain(CHIHIRO);
  });

  it("✕ après ♥ (autre téléphone) : le film reste dans la liste du groupe", async () => {
    await decideSwipe(mine.id, WHIPLASH, "keep");

    await expect(decideSwipe(mine.id, WHIPLASH, "reject")).resolves.toBe(
      "applied",
    );
    expect(await counts()).toMatchObject({ toWatch: 1 });
    expect(await deckIds()).not.toContain(WHIPLASH);
  });

  it("♥ deux fois : une seule ligne, rien de plus à annuler", async () => {
    await decideSwipe(mine.id, WHIPLASH, "keep");

    await expect(decideSwipe(mine.id, WHIPLASH, "keep")).resolves.toBe("noop");
    expect(await counts()).toMatchObject({ toWatch: 1 });
  });

  it("↺ ANNULER efface la décision : la carte revient dans le deck", async () => {
    await decideSwipe(mine.id, WHIPLASH, "keep");

    await expect(undoSwipe(mine.id, WHIPLASH, "keep")).resolves.toBe("applied");
    expect(await deckIds()).toContain(WHIPLASH);
    expect(await counts()).toMatchObject({ toWatch: 0 });
  });

  it("↺ ANNULER un BOF : la carte revient dans le deck", async () => {
    await decideSwipe(mine.id, CHIHIRO, "reject");

    await expect(undoSwipe(mine.id, CHIHIRO, "reject")).resolves.toBe(
      "applied",
    );
    expect(await deckIds()).toContain(CHIHIRO);
  });

  it("✕ BOF avec TMDB en panne : enregistré quand même (pas besoin de la fiche)", async () => {
    setTmdbDown(true);

    await expect(decideSwipe(mine.id, CHIHIRO, "reject")).resolves.toBe(
      "applied",
    );
    setTmdbDown(false);
    expect(await deckIds()).not.toContain(CHIHIRO);
  });

  it("TMDB en panne : le deck répond { ok: false } sans planter", async () => {
    setTmdbDown(true);

    await expect(loadMoreCards(mine.id, "top", 1)).resolves.toEqual({
      ok: false,
    });
  });
});
