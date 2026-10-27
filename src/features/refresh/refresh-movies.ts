import type { MovieSnapshot } from "@/domain/movie";

export interface RefreshDeps {
  /** Movies worth refreshing: « à voir » and « vus ». */
  ids(): Promise<number[]>;
  snapshot(tmdbId: number): Promise<MovieSnapshot>;
  save(snapshot: MovieSnapshot): Promise<unknown>;
}

interface RefreshReport {
  total: number;
  refreshed: number;
  failed: number[];
}

/**
 * Fetches every movie's TMDB data again (platforms, runtime, genres, trailer)
 * and stores it, `concurrency` at a time to stay polite with TMDB. One failure
 * is reported and skipped: the movie keeps its previous snapshot.
 */
export async function refreshMovies(
  deps: RefreshDeps,
  concurrency = 5,
): Promise<RefreshReport> {
  const ids = await deps.ids();
  const failed: number[] = [];
  let next = 0;

  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;
      try {
        await deps.save(await deps.snapshot(id));
      } catch {
        failed.push(id);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker),
  );

  return {
    total: ids.length,
    refreshed: ids.length - failed.length,
    failed: failed.sort((a, b) => a - b),
  };
}
