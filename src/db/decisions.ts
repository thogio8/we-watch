import { and, eq, ne, notExists } from "drizzle-orm";
import type { MovieSnapshot } from "@/domain/movie";
import type { ApplyResult, SwipeDecision } from "@/domain/transitions";
import type { Database } from "./create-database";
import { groupMovie, movieRejection, movieWant } from "./group-schema";
import { changed, listRow, rejectionOf, wishesOf } from "./list-queries";
import { upsertSnapshot } from "./snapshots";

interface SwipeInput {
  groupId: string;
  userId: string;
  tmdbId: number;
  decision: SwipeDecision;
  snapshot: MovieSnapshot;
  now?: Date;
}

type UndoInput = Omit<SwipeInput, "snapshot" | "now">;

export interface Decisions {
  /**
   * « ON LE VEUT »: the movie joins the group's list if absent, and I want it.
   * « BOF »: for me alone, in all my groups; the list is never touched.
   * "applied" iff this swipe created something (what an undo takes back).
   */
  swipe(input: SwipeInput): Promise<ApplyResult>;
  /** Takes back only what the swipe created. */
  undoSwipe(input: UndoInput): Promise<ApplyResult>;
  /** Movies the deck never shows me: the group's whole list and my BOF. */
  deckExclusions(groupId: string, userId: string): Promise<Set<number>>;
}

const myWant = ({ groupId, userId, tmdbId }: UndoInput) =>
  and(wishesOf(groupId, tmdbId), eq(movieWant.userId, userId));

function keep(db: Database, input: SwipeInput): Promise<ApplyResult> {
  const { groupId, userId, tmdbId, snapshot } = input;
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await upsertSnapshot(tx, snapshot);
    const listed = await tx
      .insert(groupMovie)
      .values({
        groupId,
        tmdbId,
        status: "to_watch",
        decidedAt: now,
        addedBy: userId,
        addedVia: "swipe",
      })
      .onConflictDoNothing()
      .returning({ id: groupMovie.tmdbId });
    const wanted = await tx
      .insert(movieWant)
      .values({ groupId, tmdbId, userId, wantedAt: now })
      .onConflictDoNothing()
      .returning({ id: movieWant.tmdbId });
    return changed(listed, wanted);
  });
}

async function reject(db: Database, input: SwipeInput): Promise<ApplyResult> {
  const { userId, tmdbId } = input;
  const rejected = await db
    .insert(movieRejection)
    .values({ userId, tmdbId, rejectedAt: input.now ?? new Date() })
    .onConflictDoNothing()
    .returning({ id: movieRejection.tmdbId });
  return changed(rejected);
}

/** My wish goes; the row too, if my swipe added it and nothing else holds it. */
function undoKeep(db: Database, input: UndoInput): Promise<ApplyResult> {
  const { groupId, userId, tmdbId } = input;
  return db.transaction(async (tx) => {
    const unwanted = await tx
      .delete(movieWant)
      .where(myWant(input))
      .returning({ id: movieWant.tmdbId });
    const otherWishes = tx
      .select()
      .from(movieWant)
      .where(and(wishesOf(groupId, tmdbId), ne(movieWant.userId, userId)));
    const unlisted = await tx
      .delete(groupMovie)
      .where(
        and(
          listRow(groupId, tmdbId),
          eq(groupMovie.status, "to_watch"),
          eq(groupMovie.addedBy, userId),
          eq(groupMovie.addedVia, "swipe"),
          notExists(otherWishes),
        ),
      )
      .returning({ id: groupMovie.tmdbId });
    return changed(unwanted, unlisted);
  });
}

async function undoReject(db: Database, input: UndoInput) {
  const deleted = await db
    .delete(movieRejection)
    .where(rejectionOf(input.userId, input.tmdbId))
    .returning({ id: movieRejection.tmdbId });
  return changed(deleted);
}

const SWIPE = { keep, reject } as const;
const UNDO = { keep: undoKeep, reject: undoReject } as const;

export function createDecisions(db: Database): Decisions {
  return {
    swipe: (input) => SWIPE[input.decision](db, input),

    undoSwipe: (input) => UNDO[input.decision](db, input),

    async deckExclusions(groupId, userId) {
      const rows = await db
        .select({ id: groupMovie.tmdbId })
        .from(groupMovie)
        .where(eq(groupMovie.groupId, groupId))
        .union(
          db
            .select({ id: movieRejection.tmdbId })
            .from(movieRejection)
            .where(eq(movieRejection.userId, userId)),
        );
      return new Set(rows.map((r) => r.id));
    },
  };
}
