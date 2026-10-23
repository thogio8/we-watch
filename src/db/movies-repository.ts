import { desc, eq, inArray } from "drizzle-orm";
import type { Movie, MovieSnapshot, MovieStatus } from "@/domain/movie";
import { type MovieAction, nextStatus } from "@/domain/transitions";
import type { Database } from "./create-database";
import { movies } from "./schema";

export type ApplyResult = "applied" | "noop";

export interface MoviesRepository {
  /** to_watch: decidedAt desc; watched: watchedAt desc. */
  listByStatus(status: "to_watch" | "watched"): Promise<Movie[]>;
  counts(): Promise<{ toWatch: number; watched: number }>;
  /** Ids of every movie already decided, whatever its status. */
  decidedIds(): Promise<Set<number>>;
  statusesOf(ids: readonly number[]): Promise<Map<number, MovieStatus>>;
  apply(
    action: MovieAction,
    tmdbId: number,
    snapshot?: MovieSnapshot,
    now?: Date,
  ): Promise<ApplyResult>;
}

export function createMoviesRepository(db: Database): MoviesRepository {
  return {
    async listByStatus(status) {
      const order = status === "watched" ? movies.watchedAt : movies.decidedAt;
      return db
        .select()
        .from(movies)
        .where(eq(movies.status, status))
        .orderBy(desc(order));
    },

    async counts() {
      const rows = await db.select({ status: movies.status }).from(movies);
      return {
        toWatch: rows.filter((r) => r.status === "to_watch").length,
        watched: rows.filter((r) => r.status === "watched").length,
      };
    },

    async decidedIds() {
      const rows = await db.select({ id: movies.tmdbId }).from(movies);
      return new Set(rows.map((r) => r.id));
    },

    async statusesOf(ids) {
      if (ids.length === 0) return new Map();
      const rows = await db
        .select({ id: movies.tmdbId, status: movies.status })
        .from(movies)
        .where(inArray(movies.tmdbId, [...ids]));
      return new Map(rows.map((r) => [r.id, r.status]));
    },

    async apply(action, tmdbId, snapshot, now = new Date()) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select({ status: movies.status })
          .from(movies)
          .where(eq(movies.tmdbId, tmdbId));
        const target = nextStatus(current?.status ?? null, action);
        if (target === null) return "noop";

        if (current === undefined) {
          if (snapshot === undefined) {
            throw new Error(
              `apply(${action}): snapshot required for new movie ${tmdbId}`,
            );
          }
          await tx
            .insert(movies)
            .values({ ...snapshot, tmdbId, status: target, decidedAt: now });
          return "applied";
        }

        if (target === "watched") {
          await tx
            .update(movies)
            .set({ status: target, watchedAt: now })
            .where(eq(movies.tmdbId, tmdbId));
        } else if (action === "unwatch") {
          await tx
            .update(movies)
            .set({ status: target, watchedAt: null })
            .where(eq(movies.tmdbId, tmdbId));
        } else {
          await tx
            .update(movies)
            .set({
              ...snapshot,
              tmdbId,
              status: target,
              decidedAt: now,
            })
            .where(eq(movies.tmdbId, tmdbId));
        }
        return "applied";
      });
    },
  };
}
