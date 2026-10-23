import { describe, expect, it, vi } from "vitest";
import type { MovieSnapshot } from "@/domain/movie";
import { type DeckDeps, loadDeckBatch } from "./deck";

function snap(tmdbId: number): MovieSnapshot {
  return {
    tmdbId,
    title: `FILM ${tmdbId}`,
    releaseYear: 2000,
    runtimeMinutes: 100,
    overview: "",
    posterPath: null,
    voteAverage: 8,
    providers: [],
  };
}

function makeDeps(
  pages: Record<number, number[]>,
  totalPages: number,
  decided: number[] = [],
) {
  const discover = vi.fn(async (page: number) => ({
    ids: pages[page] ?? [],
    totalPages,
  }));
  const snapshot = vi.fn(async (id: number) => snap(id));
  const deps: DeckDeps = {
    discover,
    snapshot,
    decidedIds: async () => new Set(decided),
  };
  return { deps, discover, snapshot };
}

describe("loadDeckBatch", () => {
  it("filtre les films déjà décidés", async () => {
    const { deps } = makeDeps({ 1: [1, 2, 3] }, 5, [2]);
    const batch = await loadDeckBatch(deps, 1, 2);
    expect(batch.cards.map((c) => c.tmdbId)).toEqual([1, 3]);
    expect(batch.nextPage).toBe(2);
  });

  it("enchaîne sur la page suivante si une page est entièrement décidée", async () => {
    const { deps, discover } = makeDeps({ 1: [1, 2], 2: [4, 5] }, 5, [1, 2]);
    const batch = await loadDeckBatch(deps, 1, 2);
    expect(batch.cards.map((c) => c.tmdbId)).toEqual([4, 5]);
    expect(batch.nextPage).toBe(3);
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it("nextPage null après la dernière page", async () => {
    const { deps } = makeDeps({ 2: [7] }, 2);
    const batch = await loadDeckBatch(deps, 2, 1);
    expect(batch.cards.map((c) => c.tmdbId)).toEqual([7]);
    expect(batch.nextPage).toBeNull();
  });

  it("s'arrête à maxPages même sans minCards", async () => {
    const { deps, discover } = makeDeps({ 1: [1], 2: [2], 3: [3] }, 10);
    const batch = await loadDeckBatch(deps, 1, 10, 2);
    expect(batch.cards.map((c) => c.tmdbId)).toEqual([1, 2]);
    expect(batch.nextPage).toBe(3);
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it("n'enrichit (snapshot) que les films retenus", async () => {
    const { deps, snapshot } = makeDeps({ 1: [1, 2, 3] }, 5, [2]);
    await loadDeckBatch(deps, 1, 2);
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(snapshot).not.toHaveBeenCalledWith(2);
  });

  it("utilise les valeurs par défaut (10 cartes, 5 pages)", async () => {
    const { deps, discover } = makeDeps({}, 50);
    const batch = await loadDeckBatch(deps, 1);
    expect(discover).toHaveBeenCalledTimes(5);
    expect(batch).toEqual({ cards: [], nextPage: 6 });
  });

  it("s'arrête quand totalPages est atteint sans minCards", async () => {
    const { deps } = makeDeps({ 1: [1] }, 1);
    const batch = await loadDeckBatch(deps, 1);
    expect(batch.nextPage).toBeNull();
  });
});
