import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { MovieStatus, StreamingProvider } from "@/domain/movie";

/** TMDB data of a movie: the columns `movies` and `movie_snapshot` share. */
export const snapshotColumns = () => ({
  tmdbId: integer("tmdb_id").primaryKey(),
  title: text("title").notNull(),
  releaseYear: integer("release_year"),
  runtimeMinutes: integer("runtime_minutes"),
  overview: text("overview").notNull(),
  posterPath: text("poster_path"),
  voteAverage: real("vote_average").notNull(),
  providers: text("providers", { mode: "json" })
    .$type<StreamingProvider[]>()
    .notNull()
    .default([]),
  genreIds: text("genre_ids", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default([]),
  trailerKey: text("trailer_key"),
});

export const movies = sqliteTable(
  "movies",
  {
    ...snapshotColumns(),
    status: text("status", { enum: ["to_watch", "watched", "rejected"] })
      .$type<MovieStatus>()
      .notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull(),
    watchedAt: integer("watched_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("movies_status_idx").on(table.status)],
);
