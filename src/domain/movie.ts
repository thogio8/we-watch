export type MovieStatus = "to_watch" | "watched" | "rejected";

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface MovieSnapshot {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  overview: string;
  posterPath: string | null;
  voteAverage: number;
  providers: StreamingProvider[];
  /** TMDB genre ids (moods: see domain/tonight). */
  genreIds: number[];
  /** YouTube key of the trailer, null when TMDB has none. */
  trailerKey: string | null;
}

export interface Movie extends MovieSnapshot {
  status: MovieStatus;
  decidedAt: Date;
  watchedAt: Date | null;
  /** Names already resolved; null = no author, or a deleted account (see legacy, watchedLegacy). */
  addedBy: string | null;
  /** In the order of the wishes. */
  wantedBy: readonly string[];
  watchedBy: string | null;
  /** Copied from the pre-accounts list: who added it was never recorded. */
  legacy: boolean;
  /** Watched before the accounts: who marked it was never recorded. */
  watchedLegacy: boolean;
}
