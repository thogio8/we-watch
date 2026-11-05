import type { Movie, MovieSnapshot, StreamingProvider } from "@/domain/movie";

export const NETFLIX: StreamingProvider = {
  id: 8,
  name: "Netflix",
  logoPath: null,
};
export const PRIME: StreamingProvider = {
  id: 119,
  name: "Amazon Prime Video",
  logoPath: null,
};
export const CANAL: StreamingProvider = {
  id: 381,
  name: "Canal+",
  logoPath: null,
};

/** A neutral TMDB snapshot: tests override only what they assert on. */
export function aSnapshot(
  tmdbId: number,
  overrides: Partial<MovieSnapshot> = {},
): MovieSnapshot {
  return {
    tmdbId,
    title: `Film ${tmdbId}`,
    releaseYear: 2000,
    runtimeMinutes: 100,
    overview: "",
    posterPath: null,
    voteAverage: 7,
    providers: [],
    genreIds: [],
    trailerKey: null,
    ...overrides,
  };
}

/** A movie saved in the list, « à voir » by default. */
export function aMovie(tmdbId: number, overrides: Partial<Movie> = {}): Movie {
  return {
    ...aSnapshot(tmdbId),
    status: "to_watch",
    decidedAt: new Date(2026, 9, 1),
    watchedAt: null,
    addedBy: null,
    wantedBy: [],
    watchedBy: null,
    legacy: false,
    favoriteAt: null,
    favoriteBy: null,
    matchedAt: null,
    groupSize: 2,
    ...overrides,
  };
}
