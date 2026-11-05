import type { MovieSnapshot, WishCard } from "@/domain/movie";
import type { DiscoverPage } from "@/tmdb/movies";

export interface DeckDeps {
  discover(page: number): Promise<DiscoverPage>;
  snapshot(tmdbId: number): Promise<MovieSnapshot>;
  decidedIds(): Promise<Set<number>>;
}

/** A card of the deck; a movie the group wants carries its `wish`. */
export type DeckCard = MovieSnapshot & { wish?: WishCard["wish"] };

export interface DeckBatch {
  cards: DeckCard[];
  nextPage: number | null;
}

/**
 * Reads TMDB pages from `fromPage`, skips movies already decided, and stops
 * once `minCards` cards are gathered or after `maxPages` pages.
 */
export async function loadDeckBatch(
  deps: DeckDeps,
  fromPage: number,
  minCards = 10,
  maxPages = 5,
): Promise<DeckBatch> {
  const decided = await deps.decidedIds();
  const cards: MovieSnapshot[] = [];
  let page = fromPage;
  let visited = 0;

  while (visited < maxPages) {
    const { ids, totalPages } = await deps.discover(page);
    const fresh = ids.filter((id) => !decided.has(id));
    const settled = await Promise.allSettled(
      fresh.map((id) => deps.snapshot(id)),
    );
    const firstFailure = settled.find((r) => r.status === "rejected");
    // One broken detail call must not sink the batch: only give up when
    // every candidate failed (TMDB down), else drop the failed cards.
    if (firstFailure && settled.every((r) => r.status === "rejected")) {
      throw firstFailure.reason;
    }
    for (const result of settled) {
      if (result.status === "fulfilled") cards.push(result.value);
    }
    visited += 1;

    if (page >= totalPages) return { cards, nextPage: null };
    page += 1;
    if (cards.length >= minCards) break;
  }
  return { cards, nextPage: page };
}
