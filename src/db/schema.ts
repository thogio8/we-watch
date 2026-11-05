import { integer, real, text } from "drizzle-orm/sqlite-core";
import type { StreamingProvider } from "@/domain/movie";

/** TMDB data of a movie: the columns of `movie_snapshot` (group-schema.ts). */
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
