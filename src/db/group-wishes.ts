import {
  and,
  count,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  max,
  ne,
  notExists,
} from "drizzle-orm";
import type { WishCard } from "@/domain/movie";
import type { Database } from "./create-database";
import {
  groupMovie,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";
import { namesByMovie, wishNames } from "./list-queries";

export const GROUP_WISHES_LIMIT = 30;

export interface GroupWishes {
  /**
   * Movies of the group still to watch that another member wants and I have
   * neither wanted nor « BOF »-ed (in any group): most wanted first, then the
   * most recent wish, then tmdb_id. At most GROUP_WISHES_LIMIT.
   */
  pending(groupId: string, userId: string): Promise<WishCard[]>;
}

/** The candidate movies with their snapshot, most wanted first. */
function candidates(db: Database, groupId: string, userId: string) {
  const wishCount = count();
  const lastWish = max(movieWant.wantedAt);
  return db
    .select({
      ...getTableColumns(movieSnapshot),
      matchedAt: groupMovie.matchedAt,
    })
    .from(groupMovie)
    .innerJoin(movieSnapshot, eq(movieSnapshot.tmdbId, groupMovie.tmdbId))
    .innerJoin(
      movieWant,
      and(
        eq(movieWant.groupId, groupMovie.groupId),
        eq(movieWant.tmdbId, groupMovie.tmdbId),
        ne(movieWant.userId, userId),
      ),
    )
    .where(
      and(
        eq(groupMovie.groupId, groupId),
        eq(groupMovie.status, "to_watch"),
        notExists(
          db
            .select({ one: movieWant.tmdbId })
            .from(movieWant)
            .where(
              and(
                eq(movieWant.groupId, groupId),
                eq(movieWant.tmdbId, groupMovie.tmdbId),
                eq(movieWant.userId, userId),
              ),
            ),
        ),
        notExists(
          db
            .select({ one: movieRejection.tmdbId })
            .from(movieRejection)
            .where(
              and(
                eq(movieRejection.userId, userId),
                eq(movieRejection.tmdbId, groupMovie.tmdbId),
              ),
            ),
        ),
      ),
    )
    .groupBy(groupMovie.tmdbId)
    .orderBy(desc(wishCount), desc(lastWish), asc(groupMovie.tmdbId))
    .limit(GROUP_WISHES_LIMIT);
}

export function createGroupWishes(db: Database): GroupWishes {
  return {
    // One batch: the movies and the names come from the same snapshot.
    async pending(groupId, userId) {
      const movies = candidates(db, groupId, userId);
      const top = movies.as("top");
      const [rows, wishes] = await db.batch([
        movies,
        wishNames(
          db,
          and(
            eq(movieWant.groupId, groupId),
            ne(movieWant.userId, userId),
            inArray(movieWant.tmdbId, db.select({ id: top.tmdbId }).from(top)),
          ),
        ),
      ]);
      const names = namesByMovie(wishes);
      return rows.map(({ matchedAt, ...snapshot }) => ({
        ...snapshot,
        wish: {
          // Same snapshot as the movies, each wanted by someone else: its
          // entry exists, and never holds my name.
          others: names.get(snapshot.tmdbId) as string[],
          matched: matchedAt !== null,
        },
      }));
    },
  };
}
