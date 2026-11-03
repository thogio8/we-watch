import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember } from "@/server/groups";
import { revalidateGroupPages, revalidateListPages } from "@/server/revalidate";
import type { MovieSnapshot } from "@/domain/movie";
import { expectRefusedFirst } from "@tests/helpers/refused";
import { TmdbError } from "@/tmdb/client";
import type { DeckId } from "@/tmdb/decks";
import {
  decideSwipe,
  loadMoreCards,
  type SwipeDecision,
  undoSwipe,
} from "./actions";

const swipe = vi.fn();
const undo = vi.fn();
const getDeckDeps = vi.fn();
const getMovieSnapshot = vi.fn();
const loadDeckBatch = vi.fn();
const client = { get: vi.fn() };
const deckDeps = { discover: vi.fn(), snapshot: vi.fn(), decidedIds: vi.fn() };

vi.mock("@/server/groups");
vi.mock("@/server/container", () => ({
  getDecisions: () => ({ swipe, undoSwipe: undo }),
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

const GROUP = "groupe-1";

beforeEach(() => {
  vi.mocked(assertMember).mockClear();
  swipe.mockReset().mockResolvedValue("applied");
  undo.mockReset().mockResolvedValue("applied");
  getDeckDeps.mockReset().mockReturnValue(deckDeps);
  vi.mocked(revalidateListPages).mockReset();
  vi.mocked(revalidateGroupPages).mockReset();
  getMovieSnapshot.mockReset().mockResolvedValue(WHIPLASH);
  loadDeckBatch.mockReset();
});

describe("decideSwipe", () => {
  it.each([
    ["keep", { snapshot: WHIPLASH }],
    ["reject", {}],
  ] as const)(
    "%s enregistre la décision de Léa dans le groupe et périme TIRER et LISTE",
    async (decision, extra) => {
      await expect(decideSwipe(GROUP, 244786, decision)).resolves.toBe(
        "applied",
      );

      expect(assertMember).toHaveBeenCalledWith(GROUP);
      expect(swipe).toHaveBeenCalledWith({
        groupId: GROUP,
        userId: "user-1",
        tmdbId: 244786,
        decision,
        ...extra,
      });
      expect(revalidateListPages).toHaveBeenCalledOnce();
      // The deck on screen is left alone: no SWIPER refresh mid-session.
      expect(revalidateGroupPages).not.toHaveBeenCalled();
    },
  );

  it("♥ relit la fiche chez TMDB plutôt que de croire le client", async () => {
    await decideSwipe(GROUP, 244786, "keep");

    expect(getMovieSnapshot).toHaveBeenCalledExactlyOnceWith(client, 244786);
  });

  it("✕ BOF ne demande rien à TMDB : la fiche ne sert pas", async () => {
    await decideSwipe(GROUP, 244786, "reject");

    expect(getMovieSnapshot).not.toHaveBeenCalled();
  });

  it("signale une décision qui n’a rien créé (rien à annuler)", async () => {
    swipe.mockResolvedValue("noop");
    await expect(decideSwipe(GROUP, 244786, "keep")).resolves.toBe("noop");
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(decideSwipe(GROUP, tmdbId, "keep")).rejects.toThrow(
        "invalid tmdbId",
      );
      expect(getMovieSnapshot).not.toHaveBeenCalled();
      expect(swipe).not.toHaveBeenCalled();
    },
  );

  it.each(["watched", "", null, "KEEP"] as unknown as SwipeDecision[])(
    "refuse une décision invalide (%s)",
    async (decision) => {
      await expect(decideSwipe(GROUP, 129, decision)).rejects.toThrow(
        "invalid decision",
      );
      expect(swipe).not.toHaveBeenCalled();
    },
  );
});

describe("undoSwipe", () => {
  it.each(["keep", "reject"] as const)(
    "efface la décision %s et périme TIRER et LISTE",
    async (decision) => {
      await expect(undoSwipe(GROUP, 244786, decision)).resolves.toBe("applied");
      expect(assertMember).toHaveBeenCalledWith(GROUP);
      expect(undo).toHaveBeenCalledWith({
        groupId: GROUP,
        userId: "user-1",
        tmdbId: 244786,
        decision,
      });
      expect(revalidateListPages).toHaveBeenCalledOnce();
      // The deck on screen is left alone: no SWIPER refresh mid-session.
      expect(revalidateGroupPages).not.toHaveBeenCalled();
    },
  );

  it("refuse un identifiant ou une décision invalide", async () => {
    await expect(undoSwipe(GROUP, 0, "keep")).rejects.toThrow("invalid tmdbId");
    await expect(
      undoSwipe(GROUP, 129, "watched" as unknown as SwipeDecision),
    ).rejects.toThrow("invalid decision");
    expect(undo).not.toHaveBeenCalled();
  });
});

describe("loadMoreCards", () => {
  it("renvoie le lot de la page demandée, pour le deck demandé", async () => {
    const batch = { cards: [WHIPLASH], nextPage: 3 };
    loadDeckBatch.mockResolvedValue(batch);

    await expect(loadMoreCards(GROUP, "animation", 2)).resolves.toEqual({
      ok: true,
      batch,
    });
    expect(assertMember).toHaveBeenCalledWith(GROUP);
    // The deck leaves out the group's list and Léa's own BOF.
    expect(getDeckDeps).toHaveBeenCalledWith("animation", GROUP, "user-1");
    expect(loadDeckBatch).toHaveBeenCalledWith(deckDeps, 2);
  });

  it.each(["palme", "", 3] as unknown as DeckId[])(
    "refuse un deck inconnu (%s)",
    async (deck) => {
      await expect(loadMoreCards(GROUP, deck, 1)).rejects.toThrow(
        "invalid deck",
      );
      expect(loadDeckBatch).not.toHaveBeenCalled();
    },
  );

  it("une erreur TMDB devient { ok: false }", async () => {
    loadDeckBatch.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(loadMoreCards(GROUP, "top", 1)).resolves.toEqual({
      ok: false,
    });
  });

  it("laisse remonter les autres erreurs", async () => {
    loadDeckBatch.mockRejectedValue(new Error("database is locked"));

    await expect(loadMoreCards(GROUP, "top", 1)).rejects.toThrow(
      "database is locked",
    );
  });

  it.each([0, -2, 2.5, Number.NaN, "2" as unknown as number])(
    "refuse une page invalide (%s)",
    async (page) => {
      await expect(loadMoreCards(GROUP, "top", page)).rejects.toThrow(
        "invalid page",
      );
      expect(loadDeckBatch).not.toHaveBeenCalled();
    },
  );
});

describe("hors du groupe, ou sans session", () => {
  it.each([
    ["decideSwipe", () => decideSwipe("groupe-b", 0, "keep")],
    ["loadMoreCards", () => loadMoreCards("groupe-b", "palme" as DeckId, 0)],
    ["undoSwipe", () => undoSwipe("groupe-b", 0, "keep")],
  ] as const)(
    "%s refuse avant toute validation, sans rien faire",
    (_name, call) =>
      expectRefusedFirst(call, [
        getMovieSnapshot,
        swipe,
        undo,
        getDeckDeps,
        loadDeckBatch,
        vi.mocked(revalidateListPages),
      ]),
  );
});
