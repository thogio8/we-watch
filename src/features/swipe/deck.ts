import type { MovieSnapshot } from "@/domain/movie";
import type { DiscoverPage } from "@/tmdb/movies";

export interface DeckDeps {
  discover(page: number): Promise<DiscoverPage>;
  snapshot(tmdbId: number): Promise<MovieSnapshot>;
  decidedIds(): Promise<Set<number>>;
}

export interface DeckBatch {
  cards: MovieSnapshot[];
  nextPage: number | null;
}

/**
 * Parcourt les pages à partir de fromPage, ignore les films déjà décidés,
 * s'arrête dès minCards cartes réunies ou après maxPages pages.
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
    cards.push(...(await Promise.all(fresh.map((id) => deps.snapshot(id)))));
    visited += 1;

    if (page >= totalPages) return { cards, nextPage: null };
    page += 1;
    if (cards.length >= minCards) break;
  }
  return { cards, nextPage: page };
}
