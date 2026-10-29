import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Movie } from "@/domain/movie";
import { user } from "./auth-schema";
import type { Database } from "./create-database";
import {
  groupMovie,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";

// Conditions shared by the repositories of a group's list.

/** The row of a movie in a group's list. */
export const listRow = (groupId: string, tmdbId: number) =>
  and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId));

/** A member's « BOF » on a movie. */
export const rejectionOf = (userId: string, tmdbId: number) =>
  and(eq(movieRejection.userId, userId), eq(movieRejection.tmdbId, tmdbId));

const adder = alias(user, "adder");
const watcher = alias(user, "watcher");

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
      legacy: groupMovie.legacy,
      addedBy: adder.name,
      watchedBy: watcher.name,
    })
    .from(groupMovie)
    .innerJoin(movieSnapshot, eq(movieSnapshot.tmdbId, groupMovie.tmdbId))
    .leftJoin(adder, eq(adder.id, groupMovie.addedBy))
    .leftJoin(watcher, eq(watcher.id, groupMovie.watchedBy))
    .where(and(eq(groupMovie.groupId, groupId), where))
    .orderBy(...orderBy);
  if (rows.length === 0) return [];
  const wanted = await wishes(
    db,
    groupId,
    rows.map((r) => r.tmdbId),
  );
  return rows.map((row) => ({
    ...row,
    wantedBy: wanted.get(row.tmdbId) ?? [],
  }));
}
