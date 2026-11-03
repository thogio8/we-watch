/** How many films a search shows. */
const MAX_SEARCH_RESULTS = 8;
/** TMDB's own best matches kept whatever their votes (a recent release). */
const KEEP_TMDB_FIRST = 4;

type SearchHit = { id: number; voteCount: number };

/**
 * TMDB ranks a search by text alone: for « Wall-E », WALL·E (21 000 votes)
 * comes 37th, behind obscure films about walls. Keep TMDB's first matches,
 * fill up with the most voted hits, and show them most voted first (ties in
 * TMDB's order).
 */
export function pickSearchResults(hits: readonly SearchHit[]): number[] {
  const byVotes = [...hits].sort((a, b) => b.voteCount - a.voteCount);
  const picked = new Map<number, SearchHit>();
  for (const hit of [...hits.slice(0, KEEP_TMDB_FIRST), ...byVotes]) {
    if (picked.size === MAX_SEARCH_RESULTS) break;
    if (!picked.has(hit.id)) picked.set(hit.id, hit);
  }
  return [...picked.values()]
    .sort((a, b) => b.voteCount - a.voteCount)
    .map((hit) => hit.id);
}
