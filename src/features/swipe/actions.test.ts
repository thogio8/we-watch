import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MovieSnapshot } from "@/domain/movie";
import { TmdbError } from "@/tmdb/client";
import { decideSwipe, loadMoreCards, type SwipeDecision } from "./actions";

const apply = vi.fn();
const revalidatePath = vi.fn();
const getMovieSnapshot = vi.fn();
const loadDeckBatch = vi.fn();
const client = { get: vi.fn() };
const deckDeps = { discover: vi.fn(), snapshot: vi.fn(), decidedIds: vi.fn() };

vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply }),
  getTmdbClient: () => client,
  getDeckDeps: () => deckDeps,
}));
vi.mock("@/tmdb/movies", () => ({
  getMovieSnapshot: (...args: unknown[]) => getMovieSnapshot(...args),
}));
vi.mock("./deck", () => ({
  loadDeckBatch: (...args: unknown[]) => loadDeckBatch(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const WHIPLASH: MovieSnapshot = {
  tmdbId: 244786,
  title: "Whiplash",
  releaseYear: 2014,
  runtimeMinutes: 107,
  overview: "",
  posterPath: null,
  voteAverage: 8.4,
  providers: [],
};

beforeEach(() => {
  apply.mockReset().mockResolvedValue("applied");
  revalidatePath.mockReset();
  getMovieSnapshot.mockReset().mockResolvedValue(WHIPLASH);
  loadDeckBatch.mockReset();
});

describe("decideSwipe", () => {
  it.each([
    ["keep", "swipe_keep"],
    ["reject", "swipe_reject"],
  ] as const)(
    "%s enregistre le film avec son snapshot et rafraîchit les pages",
    async (decision, action) => {
      await decideSwipe(244786, decision);

      expect(getMovieSnapshot).toHaveBeenCalledWith(client, 244786);
      expect(apply).toHaveBeenCalledWith(action, 244786, WHIPLASH);
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    },
  );

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(decideSwipe(tmdbId, "keep")).rejects.toThrow(
        "invalid tmdbId",
      );
      expect(getMovieSnapshot).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    },
  );

  it.each(["watched", "", null, "KEEP"] as unknown as SwipeDecision[])(
    "refuse une décision invalide (%s)",
    async (decision) => {
      await expect(decideSwipe(129, decision)).rejects.toThrow(
        "invalid decision",
      );
      expect(apply).not.toHaveBeenCalled();
    },
  );
});

describe("loadMoreCards", () => {
  it("renvoie le lot de la page demandée", async () => {
    const batch = { cards: [WHIPLASH], nextPage: 3 };
    loadDeckBatch.mockResolvedValue(batch);

    await expect(loadMoreCards(2)).resolves.toEqual({ ok: true, batch });
    expect(loadDeckBatch).toHaveBeenCalledWith(deckDeps, 2);
  });

  it("une erreur TMDB devient { ok: false }", async () => {
    loadDeckBatch.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(loadMoreCards(1)).resolves.toEqual({ ok: false });
  });

  it("laisse remonter les autres erreurs", async () => {
    loadDeckBatch.mockRejectedValue(new Error("database is locked"));

    await expect(loadMoreCards(1)).rejects.toThrow("database is locked");
  });

  it.each([0, -2, 2.5, Number.NaN, "2" as unknown as number])(
    "refuse une page invalide (%s)",
    async (page) => {
      await expect(loadMoreCards(page)).rejects.toThrow("invalid page");
      expect(loadDeckBatch).not.toHaveBeenCalled();
    },
  );
});
