import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember } from "@/server/groups";
import { revalidateGroupPages, revalidateListPages } from "@/server/revalidate";
import type { MovieSnapshot } from "@/domain/movie";
import { expectRefusedFirst } from "@tests/helpers/refused";
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
const getListed = vi.fn();
const getMovieSnapshot = vi.fn();
const loadDeckBatch = vi.fn();
const client = { get: vi.fn() };

vi.mock("@/server/groups");
vi.mock("@/server/container", () => ({
  getDecisions: () => ({ swipe, undoSwipe: undo }),
  getSnapshots: () => ({ getListed }),
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
  swipe.mockReset().mockResolvedValue({ result: "applied", matched: false });
  undo.mockReset().mockResolvedValue("applied");
  getDeckDeps.mockReset();
  getListed.mockReset().mockResolvedValue(null);
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
      await expect(decideSwipe(GROUP, 244786, decision)).resolves.toEqual({
        result: "applied",
        matched: false,
      });

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
    swipe.mockResolvedValue({ result: "noop", matched: false });
    await expect(decideSwipe(GROUP, 244786, "keep")).resolves.toEqual({
      result: "noop",
      matched: false,
    });
  });

  it("♥ sur un film déjà dans la liste du groupe lit la fiche en base, sans TMDB", async () => {
    getListed.mockResolvedValue(WHIPLASH);

    await decideSwipe(GROUP, 244786, "keep");

    expect(getListed).toHaveBeenCalledWith(GROUP, 244786);
    expect(getMovieSnapshot).not.toHaveBeenCalled();
    expect(swipe).toHaveBeenCalledWith(
      expect.objectContaining({ snapshot: WHIPLASH }),
    );
  });

  it("transmet le match au client", async () => {
    swipe.mockResolvedValue({ result: "applied", matched: true });
    await expect(decideSwipe(GROUP, 244786, "keep")).resolves.toMatchObject({
      matched: true,
    });
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

describe("hors du groupe, ou sans session", () => {
  it.each([
    ["decideSwipe", () => decideSwipe("groupe-b", 0, "keep")],
    ["loadMoreCards", () => loadMoreCards("groupe-b", "palme" as DeckId, 0)],
    ["undoSwipe", () => undoSwipe("groupe-b", 0, "keep")],
    // Valid arguments: only membership can refuse, before any read.
    ["decideSwipe (valide)", () => decideSwipe("groupe-b", 244786, "keep")],
    ["undoSwipe (valide)", () => undoSwipe("groupe-b", 244786, "keep")],
  ] as const)("%s refuse avant toute lecture, sans rien faire", (_name, call) =>
    expectRefusedFirst(call, [
      getMovieSnapshot,
      getListed,
      swipe,
      undo,
      getDeckDeps,
      loadDeckBatch,
      vi.mocked(revalidateListPages),
    ]),
  );
});
