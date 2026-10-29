import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { Movie, MovieSnapshot, MovieStatus } from "@/domain/movie";
import {
  type ApplyResult,
  type MovieAction,
  nextStatus,
} from "@/domain/transitions";
import type { Database } from "./create-database";
import { groupMovie, movieRejection } from "./group-schema";
import { listRow, rejectionOf, selectMovies } from "./list-queries";
import { upsertSnapshot } from "./snapshots";

/** What a member does on the list itself (swipes: see decisions). */
type ListAction = Exclude<MovieAction, "swipe_keep" | "swipe_reject">;

interface ApplyInput {
  groupId: string;
  userId: string;
  action: ListAction;
  tmdbId: number;
  snapshot?: MovieSnapshot;
  now?: Date;
}

export interface GroupList {
  /** A movie of the group's list (« à voir » or « vu »), null otherwise. */
  findInList(groupId: string, tmdbId: number): Promise<Movie | null>;
  /** to_watch: decidedAt desc; watched: watchedAt desc. */
  listByStatus(
    groupId: string,
    status: "to_watch" | "watched",
  ): Promise<Movie[]>;
  counts(groupId: string): Promise<{ toWatch: number; watched: number }>;
  /** Status in the group's list, set-aside movies included. */
  statusesOf(
    groupId: string,
    ids: readonly number[],
  ): Promise<Map<number, MovieStatus>>;
  apply(input: ApplyInput): Promise<ApplyResult>;
}

type Who = { userId: string; now: Date };

/** The columns each action writes, besides the status (see nextStatus). */
const CHANGES: Record<
  ListAction,
  (who: Who) => Partial<typeof groupMovie.$inferInsert>
> = {
  search_add: ({ userId, now }) => ({
    decidedAt: now,
    addedBy: userId,
    addedVia: "search",
    legacy: false,
  }),
  remove: ({ now }) => ({ decidedAt: now }),
  mark_watched: ({ userId, now }) => ({ watchedAt: now, watchedBy: userId }),
  unwatch: () => ({ watchedAt: null, watchedBy: null }),
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
      const order =
        status === "watched" ? groupMovie.watchedAt : groupMovie.decidedAt;
      return selectMovies(db, groupId, eq(groupMovie.status, status), [
        desc(order),
      ]);
    },

    async counts(groupId) {
      const rows = await db
        .select({ status: groupMovie.status, n: count() })
        .from(groupMovie)
        .where(eq(groupMovie.groupId, groupId))
        .groupBy(groupMovie.status);
      const of = (status: MovieStatus) =>
        rows.find((r) => r.status === status)?.n ?? 0;
      return { toWatch: of("to_watch"), watched: of("watched") };
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

/** Reads the current status and writes the transition in one transaction. */
function applyAction(db: Database, input: ApplyInput): Promise<ApplyResult> {
  const { groupId, userId, action, tmdbId, snapshot } = input;
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: groupMovie.status })
      .from(groupMovie)
      .where(listRow(groupId, tmdbId));
    const target = nextStatus(current?.status ?? null, action);
    if (target === null) return "noop";
    if (current === undefined && snapshot === undefined) {
      throw new Error(
        `apply(${action}): snapshot required for new movie ${tmdbId}`,
      );
    }

    if (snapshot !== undefined) await upsertSnapshot(tx, snapshot);
    const changes = { status: target, ...CHANGES[action]({ userId, now }) };
    if (current === undefined) {
      await tx.insert(groupMovie).values({
        groupId,
        tmdbId,
        decidedAt: now,
        addedVia: "search",
        ...changes,
      });
    } else {
      await tx.update(groupMovie).set(changes).where(listRow(groupId, tmdbId));
    }
    // Searching for a movie and adding it reverses my « BOF » on it.
    if (action === "search_add") {
      await tx.delete(movieRejection).where(rejectionOf(userId, tmdbId));
    }
    return "applied";
  });
}
