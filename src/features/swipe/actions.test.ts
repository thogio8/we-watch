import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertUnlocked } from "@/access/assert-unlocked";
import { revalidateListPages } from "@/server/revalidate";
import type { MovieSnapshot } from "@/domain/movie";
import { TmdbError } from "@/tmdb/client";
import type { DeckId } from "@/tmdb/decks";
import {
  decideSwipe,
  loadMoreCards,
  type SwipeDecision,
  undoSwipe,
} from "./actions";

const apply = vi.fn();
const undo = vi.fn();
const getDeckDeps = vi.fn();
const getMovieSnapshot = vi.fn();
const loadDeckBatch = vi.fn();
const client = { get: vi.fn() };
const deckDeps = { discover: vi.fn(), snapshot: vi.fn(), decidedIds: vi.fn() };

vi.mock("@/access/assert-unlocked");
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply, undoSwipe: undo }),
  getTmdbClient: () => client,
  getDeckDeps: (...args: unknown[]) => getDeckDeps(...args),
}));
vi.mock("@/tmdb/movies", () => ({
  getMovieSnapshot: (...args: unknown[]) => getMovieSnapshot(...args),
}));
vi.mock("./deck", () => ({
  loadDeckBatch: (...args: unknown[]) => loadDeckBatch(...args),
}));
vi.mock("@/server/revalidate");

const WHIPLASH: MovieSnapshot = {
  tmdbId: 244786,
  title: "Whiplash",
  releaseYear: 2014,
  runtimeMinutes: 107,
  overview: "",
  posterPath: null,
  voteAverage: 8.4,
  providers: [],
  genreIds: [],
  trailerKey: null,
};

beforeEach(() => {
  vi.mocked(assertUnlocked).mockReset().mockResolvedValue(undefined);
  apply.mockReset().mockResolvedValue("applied");
  undo.mockReset().mockResolvedValue("applied");
  getDeckDeps.mockReset().mockReturnValue(deckDeps);
  vi.mocked(revalidateListPages).mockReset();
  getMovieSnapshot.mockReset().mockResolvedValue(WHIPLASH);
  loadDeckBatch.mockReset();
});

describe("decideSwipe", () => {
  it.each([
    ["keep", "swipe_keep"],
    ["reject", "swipe_reject"],
  ] as const)(
    "%s enregistre le film avec son snapshot et périme TIRER et LISTE",
    async (decision, action) => {
      await expect(decideSwipe(244786, decision)).resolves.toBe("applied");

      expect(getMovieSnapshot).toHaveBeenCalledWith(client, 244786);
      expect(apply).toHaveBeenCalledWith(action, 244786, WHIPLASH);
      expect(revalidateListPages).toHaveBeenCalledOnce();
    },
  );

  it("signale une décision déjà prise ailleurs", async () => {
    apply.mockResolvedValue("noop");
    await expect(decideSwipe(244786, "keep")).resolves.toBe("noop");
  });

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

describe("undoSwipe", () => {
  it.each(["keep", "reject"] as const)(
    "efface la décision %s et périme TIRER et LISTE",
    async (decision) => {
      await expect(undoSwipe(244786, decision)).resolves.toBe("applied");
      expect(undo).toHaveBeenCalledWith(244786, decision);
      expect(revalidateListPages).toHaveBeenCalledOnce();
    },
  );

  it("refuse un identifiant ou une décision invalide", async () => {
    await expect(undoSwipe(0, "keep")).rejects.toThrow("invalid tmdbId");
    await expect(
      undoSwipe(129, "watched" as unknown as SwipeDecision),
    ).rejects.toThrow("invalid decision");
    expect(undo).not.toHaveBeenCalled();
  });
});

describe("loadMoreCards", () => {
  it("renvoie le lot de la page demandée, pour le deck demandé", async () => {
    const batch = { cards: [WHIPLASH], nextPage: 3 };
    loadDeckBatch.mockResolvedValue(batch);

    await expect(loadMoreCards("animation", 2)).resolves.toEqual({
      ok: true,
      batch,
    });
    expect(getDeckDeps).toHaveBeenCalledWith("animation");
    expect(loadDeckBatch).toHaveBeenCalledWith(deckDeps, 2);
  });

  it.each(["palme", "", 3] as unknown as DeckId[])(
    "refuse un deck inconnu (%s)",
    async (deck) => {
      await expect(loadMoreCards(deck, 1)).rejects.toThrow("invalid deck");
      expect(loadDeckBatch).not.toHaveBeenCalled();
    },
  );

  it("une erreur TMDB devient { ok: false }", async () => {
    loadDeckBatch.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(loadMoreCards("top", 1)).resolves.toEqual({ ok: false });
  });

  it("laisse remonter les autres erreurs", async () => {
    loadDeckBatch.mockRejectedValue(new Error("database is locked"));

    await expect(loadMoreCards("top", 1)).rejects.toThrow("database is locked");
  });

  it.each([0, -2, 2.5, Number.NaN, "2" as unknown as number])(
    "refuse une page invalide (%s)",
    async (page) => {
      await expect(loadMoreCards("top", page)).rejects.toThrow("invalid page");
      expect(loadDeckBatch).not.toHaveBeenCalled();
    },
  );
});

describe("appareil verrouillé", () => {
  it.each([
    ["decideSwipe", () => decideSwipe(244786, "keep")],
    ["loadMoreCards", () => loadMoreCards("top", 1)],
    ["undoSwipe", () => undoSwipe(244786, "keep")],
  ] as const)("%s refuse sans rien appliquer", async (_name, call) => {
    vi.mocked(assertUnlocked).mockRejectedValue(new Error("device is locked"));

    await expect(call()).rejects.toThrow("device is locked");
    expect(getMovieSnapshot).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
    expect(loadDeckBatch).not.toHaveBeenCalled();
  });
});
