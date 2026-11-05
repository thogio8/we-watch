import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember } from "@/server/groups";
import type { WishCard } from "@/domain/movie";
import { aSnapshot } from "@tests/helpers/movies";
import { TmdbError } from "@/tmdb/client";
import type { DeckId } from "@/tmdb/decks";
import { loadMoreCards } from "./actions";

const getDeckDeps = vi.fn();
const pending = vi.fn();
const loadDeckBatch = vi.fn();
const deckDeps = { discover: vi.fn(), snapshot: vi.fn(), decidedIds: vi.fn() };

vi.mock("@/server/groups");
vi.mock("@/server/container", () => ({
  getGroupWishes: () => ({ pending }),
  getDeckDeps: (...args: unknown[]) => getDeckDeps(...args),
}));
vi.mock("./deck", () => ({
  loadDeckBatch: (...args: unknown[]) => loadDeckBatch(...args),
}));

const GROUP = "groupe-1";
const WHIPLASH = aSnapshot(244786, { title: "Whiplash" });
const CHIHIRO = aSnapshot(129, { title: "Chihiro" });
const WANTED: WishCard = {
  ...aSnapshot(496243, { title: "Parasite" }),
  wish: { others: ["Hugo"], matched: false },
};

beforeEach(() => {
  vi.mocked(assertMember).mockClear();
  getDeckDeps.mockReset().mockReturnValue(deckDeps);
  pending.mockReset().mockResolvedValue([]);
  loadDeckBatch.mockReset();
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

  it("la page 1 met la file du groupe en tête, avant le thème", async () => {
    pending.mockResolvedValue([WANTED]);
    loadDeckBatch.mockResolvedValue({ cards: [WHIPLASH], nextPage: 2 });

    await expect(loadMoreCards(GROUP, "top", 1)).resolves.toEqual({
      ok: true,
      batch: { cards: [WANTED, WHIPLASH], nextPage: 2 },
    });
    expect(pending).toHaveBeenCalledWith(GROUP, "user-1");
  });

  it("une page 2 ne remet pas la file", async () => {
    pending.mockResolvedValue([WANTED]);
    loadDeckBatch.mockResolvedValue({ cards: [CHIHIRO], nextPage: null });

    await expect(loadMoreCards(GROUP, "top", 2)).resolves.toEqual({
      ok: true,
      batch: { cards: [CHIHIRO], nextPage: null },
    });
    expect(pending).not.toHaveBeenCalled();
  });

  it("aucun film en double entre la file et le thème", async () => {
    pending.mockResolvedValue([WANTED]);
    loadDeckBatch.mockResolvedValue({
      cards: [aSnapshot(WANTED.tmdbId), CHIHIRO],
      nextPage: null,
    });

    const result = await loadMoreCards(GROUP, "top", 1);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.batch.cards).toEqual([WANTED, CHIHIRO]);
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

  it("TMDB en panne avec une file : la file s’affiche, la page 1 sera retentée", async () => {
    pending.mockResolvedValue([WANTED]);
    loadDeckBatch.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(loadMoreCards(GROUP, "top", 1)).resolves.toEqual({
      ok: true,
      batch: { cards: [WANTED], nextPage: 1 },
    });
  });

  it("TMDB en panne sans file : { ok: false }", async () => {
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
