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
  /** Names already resolved; null = a deleted account, or no author (see legacy). */
  addedBy: string | null;
  /** In the order of the wishes. */
  wantedBy: readonly string[];
  watchedBy: string | null;
  /** Copied from the pre-accounts list (added_via « legacy »): who added it was never recorded. */
  legacy: boolean;
  /** Set only for a movie still to watch. */
  favoriteAt: Date | null;
  /** Name resolved; null with favoriteAt set = deleted account. */
  favoriteBy: string | null;
  /** Set when the whole group kept it; never recomputed. */
  matchedAt: Date | null;
  /** Members of the group when read. */
  groupSize: number;
}

export const isFavorite = (m: Pick<Movie, "favoriteAt">): boolean =>
  m.favoriteAt !== null;

export const isMatch = (m: Pick<Movie, "matchedAt">): boolean =>
  m.matchedAt !== null;

export interface ListCounts {
  toWatch: number;
  watched: number;
  favorites: number;
  matches: number;
}

/** A movie the group wants and I have not swiped yet. */
export type WishCard = MovieSnapshot & {
  wish: {
    /** The other members who want it, in the order of the wishes. */
    others: readonly string[];
    /** Set when the whole group kept it. */
    matched: boolean;
  };
};
