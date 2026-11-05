import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  inArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Movie } from "@/domain/movie";
import type { ApplyResult } from "@/domain/transitions";
import { user } from "./auth-schema";
import type { Database } from "./create-database";
import {
  groupMovie,
  movieRejection,
  movieSnapshot,
  membership,
  movieWant,
} from "./group-schema";

// Conditions shared by the repositories of a group's list.

/** The row of a movie in a group's list. */
export const listRow = (groupId: string, tmdbId: number) =>
  and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId));

/** The wishes of every member on a movie of a group's list. */
export const wishesOf = (groupId: string, tmdbId: number) =>
  and(eq(movieWant.groupId, groupId), eq(movieWant.tmdbId, tmdbId));

/** A member's « BOF » on a movie. */
export const rejectionOf = (userId: string, tmdbId: number) =>
  and(eq(movieRejection.userId, userId), eq(movieRejection.tmdbId, tmdbId));

/** "applied" iff one of the writes returned a row. */
export const changed = (...results: unknown[][]): ApplyResult =>
  results.some((rows) => rows.length > 0) ? "applied" : "noop";

const adder = alias(user, "adder");
const watcher = alias(user, "watcher");
const favoriter = alias(user, "favoriter");

/** Names of the members who want each movie, in the order of the wishes. */
async function wishes(
  db: Database,
  groupId: string,
  tmdbIds: number[],
): Promise<Map<number, string[]>> {
  const rows = await db
    .select({ tmdbId: movieWant.tmdbId, name: user.name })
    .from(movieWant)
    .innerJoin(user, eq(user.id, movieWant.userId))
    .where(
      and(eq(movieWant.groupId, groupId), inArray(movieWant.tmdbId, tmdbIds)),
    )
    // Same millisecond: insertion order.
    .orderBy(asc(movieWant.wantedAt), asc(sql`${movieWant}.rowid`));
  const names = new Map<number, string[]>();
  for (const { tmdbId, name } of rows) {
    names.set(tmdbId, [...(names.get(tmdbId) ?? []), name]);
  }
  return names;
}

/** How many members the group has. */
async function sizeOf(db: Database, groupId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(membership)
    .where(eq(membership.groupId, groupId));
  return rows.reduce((total, r) => total + r.n, 0);
}

/**
 * Movies of a group's list matching `where`, with their snapshot and the
 * names of who added, wanted and watched them (null: no author, or a
 * deleted account).
 */
export async function selectMovies(
  db: Database,
  groupId: string,
  where: SQL | undefined,
  orderBy: SQL[] = [],
): Promise<Movie[]> {
  const rows = await db
    .select({
      ...getTableColumns(movieSnapshot),
      status: groupMovie.status,
      decidedAt: groupMovie.decidedAt,
      watchedAt: groupMovie.watchedAt,
      legacy: sql<boolean>`${groupMovie.addedVia} = 'legacy'`.mapWith(Boolean),
      addedBy: adder.name,
      watchedBy: watcher.name,
      favoriteAt: groupMovie.favoriteAt,
      favoriteBy: favoriter.name,
    })
    .from(groupMovie)
    .innerJoin(movieSnapshot, eq(movieSnapshot.tmdbId, groupMovie.tmdbId))
    .leftJoin(adder, eq(adder.id, groupMovie.addedBy))
    .leftJoin(watcher, eq(watcher.id, groupMovie.watchedBy))
    .leftJoin(favoriter, eq(favoriter.id, groupMovie.favoriteBy))
    .where(and(eq(groupMovie.groupId, groupId), where))
    .orderBy(...orderBy);
  if (rows.length === 0) return [];
  const wanted = await wishes(
    db,
    groupId,
    rows.map((r) => r.tmdbId),
  );
  const groupSize = await sizeOf(db, groupId);
  return rows.map((row) => ({
    ...row,
    // Only a movie still to watch is a favourite, whatever the columns hold.
    ...(row.status === "to_watch"
      ? {}
      : { favoriteAt: null, favoriteBy: null }),
    wantedBy: wanted.get(row.tmdbId) ?? [],
    // Read from the database in the next step.
    matchedAt: null,
    groupSize,
  }));
}
