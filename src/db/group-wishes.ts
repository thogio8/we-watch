import {
  and,
  count,
  asc,
  desc,
  eq,
  getTableColumns,
  max,
  ne,
  notExists,
} from "drizzle-orm";
import type { WishCard } from "@/domain/movie";
import type { Database, Executor } from "./create-database";
import {
  groupMovie,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";
import { wishes } from "./list-queries";

export const GROUP_WISHES_LIMIT = 30;

export interface GroupWishes {
  /**
   * Movies of the group still to watch that another member wants and I have
   * neither wanted nor « BOF »-ed (in any group): most wanted first, then the
   * most recent wish, then tmdb_id. At most GROUP_WISHES_LIMIT.
   */
  pending(groupId: string, userId: string): Promise<WishCard[]>;
}

/** The candidate movies, most wanted first. */
function candidates(tx: Executor, groupId: string, userId: string) {
  const wishCount = count();
  const lastWish = max(movieWant.wantedAt);
  return tx
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
          tx
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
          tx
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
    // One transaction: the movies and the names come from the same snapshot.
    pending: (groupId, userId) =>
      db.transaction(async (tx) => {
        const rows = await candidates(tx, groupId, userId);
        if (rows.length === 0) return [];
        const names = await wishes(
          tx,
          groupId,
          rows.map((r) => r.tmdbId),
          userId,
        );
        return rows.map(({ matchedAt, ...snapshot }) => ({
          ...snapshot,
          wish: {
            // Read in the same snapshot as the movies, each of which has a
            // wish from someone else: its entry exists.
            others: names.get(snapshot.tmdbId) as string[],
            matched: matchedAt !== null,
          },
        }));
      }),
  };
}
