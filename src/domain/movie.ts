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
}

export interface Movie extends MovieSnapshot {
  status: MovieStatus;
  decidedAt: Date;
  watchedAt: Date | null;
}
