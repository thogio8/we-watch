import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  ListCounts,
  Movie,
  MovieSnapshot,
  MovieStatus,
} from "@/domain/movie";
import {
  type ApplyResult,
  type MovieAction,
  nextStatus,
} from "@/domain/transitions";
import type { Database, Executor } from "./create-database";
import { groupMovie, movieRejection, movieWant } from "./group-schema";
import {
  changed,
  listRow,
  rejectionOf,
  selectMovies,
  wishesOf,
} from "./list-queries";
import { upsertSnapshot } from "./snapshots";

interface ApplyInput {
  groupId: string;
  userId: string;
  action: MovieAction;
  tmdbId: number;
  snapshot?: MovieSnapshot;
  now?: Date;
}

export interface GroupList {
  /** A movie of the group's list (« à voir » or « vu »), null otherwise. */
  findInList(groupId: string, tmdbId: number): Promise<Movie | null>;
  /**
   * to_watch: favourites first (favoriteAt desc), then decidedAt desc;
   * watched: watchedAt desc.
   */
  listByStatus(
    groupId: string,
    status: "to_watch" | "watched",
  ): Promise<Movie[]>;
  counts(groupId: string): Promise<ListCounts>;
  /** Status in the group's list, set-aside movies included. */
  statusesOf(
    groupId: string,
    ids: readonly number[],
  ): Promise<Map<number, MovieStatus>>;
  apply(input: ApplyInput): Promise<ApplyResult>;
}

type Who = { userId: string; now: Date };

/** A movie leaving or coming back to « à voir » never keeps a favourite. */
const NO_FAVORITE = { favoriteAt: null, favoriteBy: null } as const;

/** The columns each action writes, besides the status (see nextStatus). */
const CHANGES: Record<
  MovieAction,
  (who: Who) => Partial<typeof groupMovie.$inferInsert>
> = {
  search_add: ({ userId, now }) => ({
    decidedAt: now,
    addedBy: userId,
    addedVia: "search",
    legacy: false,
    ...NO_FAVORITE,
  }),
  remove: ({ now }) => ({ decidedAt: now, ...NO_FAVORITE }),
  mark_watched: ({ userId, now }) => ({
    watchedAt: now,
    watchedBy: userId,
    watchedLegacy: false,
    ...NO_FAVORITE,
  }),
  unwatch: () => ({
    watchedAt: null,
    watchedBy: null,
    watchedLegacy: false,
    ...NO_FAVORITE,
  }),
};

export function createGroupList(db: Database): GroupList {
  return {
    async findInList(groupId, tmdbId) {
      const [movie] = await selectMovies(
        db,
        groupId,
        and(
          eq(groupMovie.tmdbId, tmdbId),
          inArray(groupMovie.status, ["to_watch", "watched"]),
        ),
      );
      return movie ?? null;
    },

    listByStatus(groupId, status) {
      // tmdb_id last: unique in a group, so ties keep one order.
      const order =
        status === "watched"
          ? [desc(groupMovie.watchedAt), desc(groupMovie.tmdbId)]
          : [
              sql`${groupMovie.favoriteAt} IS NULL`,
              desc(groupMovie.favoriteAt),
              desc(groupMovie.decidedAt),
              desc(groupMovie.tmdbId),
            ];
      return selectMovies(db, groupId, eq(groupMovie.status, status), order);
    },

    async counts(groupId) {
      const rows = await db
        .select({
          status: groupMovie.status,
          n: count(),
          // Counts the non-null favourite dates only.
          favorites: count(groupMovie.favoriteAt),
        })
        .from(groupMovie)
        .where(eq(groupMovie.groupId, groupId))
        .groupBy(groupMovie.status);
      const of = (status: MovieStatus) =>
        rows.find((r) => r.status === status)?.n ?? 0;
      return {
        toWatch: of("to_watch"),
        watched: of("watched"),
        // Only a movie still to watch is a favourite.
        favorites: rows.find((r) => r.status === "to_watch")?.favorites ?? 0,
      };
    },

    async statusesOf(groupId, ids) {
      if (ids.length === 0) return new Map();
      const rows = await db
        .select({ id: groupMovie.tmdbId, status: groupMovie.status })
        .from(groupMovie)
        .where(
          and(
            eq(groupMovie.groupId, groupId),
            inArray(groupMovie.tmdbId, [...ids]),
          ),
        );
      return new Map(rows.map((r) => [r.id, r.status]));
    },

    apply: (input) => applyAction(db, input),
  };
}

/**
 * One transaction: searching for a movie reverses my « BOF » on it, even when
 * the list row stays as it is; then the transition is written.
 */
function applyAction(db: Database, input: ApplyInput): Promise<ApplyResult> {
  const { userId, action, tmdbId } = input;
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const cleared =
      action === "search_add"
        ? await tx
            .delete(movieRejection)
            .where(rejectionOf(userId, tmdbId))
            .returning({ id: movieRejection.tmdbId })
        : [];
    return changed(cleared, await writeTransition(tx, { ...input, now }));
  });
}

/** Reads the current status and writes the transition: the rows written. */
async function writeTransition(
  tx: Executor,
  input: ApplyInput & { now: Date },
): Promise<unknown[]> {
  const { groupId, userId, action, tmdbId, snapshot, now } = input;
  const [current] = await tx
    .select({ status: groupMovie.status })
    .from(groupMovie)
    .where(listRow(groupId, tmdbId));
  const target = nextStatus(current?.status ?? null, action);
  if (target === null) return [];
  if (current === undefined && snapshot === undefined) {
    throw new Error(
      `apply(${action}): snapshot required for new movie ${tmdbId}`,
    );
  }

  if (snapshot !== undefined) await upsertSnapshot(tx, snapshot);
  const changes = { status: target, ...CHANGES[action]({ userId, now }) };
  if (current === undefined) {
    // Only a search brings a new movie here (swipes: see decisions);
    // another member may have added it since the read: theirs stays.
    return tx
      .insert(groupMovie)
      .values({
        groupId,
        tmdbId,
        decidedAt: now,
        addedVia: "search",
        ...changes,
      })
      .onConflictDoNothing()
      .returning({ id: groupMovie.tmdbId });
  }
  // A set-aside movie added again starts fresh: earlier wishes go.
  if (current.status === "rejected") {
    await tx.delete(movieWant).where(wishesOf(groupId, tmdbId));
  }
  return tx
    .update(groupMovie)
    .set(changes)
    .where(listRow(groupId, tmdbId))
    .returning({ id: groupMovie.tmdbId });
}
