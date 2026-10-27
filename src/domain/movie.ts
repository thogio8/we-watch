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
}
