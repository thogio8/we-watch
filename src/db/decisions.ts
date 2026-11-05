import { and, eq, isNull, ne, notExists } from "drizzle-orm";
import type { MovieSnapshot } from "@/domain/movie";
import type {
  ApplyResult,
  SwipeDecision,
  SwipeOutcome,
} from "@/domain/transitions";
import type { Database } from "./create-database";
import { groupMovie, movieRejection, movieWant } from "./group-schema";
import { changed, listRow, rejectionOf, wishesOf } from "./list-queries";
import { markMatch, unmarkMatch } from "./match";
import { upsertSnapshot } from "./snapshots";

interface SwipeBase {
  groupId: string;
  userId: string;
  tmdbId: number;
  now?: Date;
}

/** « BOF » never touches the list: it needs no snapshot. */
type KeepInput = SwipeBase & { decision: "keep"; snapshot: MovieSnapshot };
type RejectInput = SwipeBase & { decision: "reject"; snapshot?: never };
type SwipeInput = KeepInput | RejectInput;

type UndoInput = Omit<SwipeBase, "now"> & { decision: SwipeDecision };

export interface Decisions {
  /**
   * « ON LE VEUT »: the movie joins the group's list if absent, and I want it.
   * « BOF »: for me alone, in all my groups; the list is never touched.
   * "applied" iff this swipe created something (what an undo takes back);
   * `matched` iff this very swipe made the movie a match.
   */
  swipe(input: SwipeInput): Promise<SwipeOutcome>;
  /** Takes back only what the swipe created. */
  undoSwipe(input: UndoInput): Promise<ApplyResult>;
  /** Movies the deck never shows me: the group's whole list and my BOF. */
  deckExclusions(groupId: string, userId: string): Promise<Set<number>>;
}

const myWant = ({ groupId, userId, tmdbId }: UndoInput) =>
  and(wishesOf(groupId, tmdbId), eq(movieWant.userId, userId));

/** Only a wish this swipe created can complete a match. */
function keep(db: Database, input: KeepInput): Promise<SwipeOutcome> {
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
    const matched =
      wanted.length > 0 &&
      (await markMatch(tx, { groupId, userId, tmdbId, now }));
    return { result: changed(listed, wanted), matched };
  });
}

async function reject(db: Database, input: RejectInput): Promise<SwipeOutcome> {
  const { userId, tmdbId } = input;
  const rejected = await db
    .insert(movieRejection)
    .values({ userId, tmdbId, rejectedAt: input.now ?? new Date() })
    .onConflictDoNothing()
    .returning({ id: movieRejection.tmdbId });
  return { result: changed(rejected), matched: false };
}

/**
 * My wish goes, and the match it made if any; the row too, if my swipe added
 * it and nothing else holds it (another member's wish, or a favourite marked
 * since).
 */
function undoKeep(db: Database, input: UndoInput): Promise<ApplyResult> {
  const { groupId, userId, tmdbId } = input;
  return db.transaction(async (tx) => {
    const unwanted = await tx
      .delete(movieWant)
      .where(myWant(input))
      .returning({ id: movieWant.tmdbId, wantedAt: movieWant.wantedAt });
    const [mine] = unwanted;
    if (mine !== undefined) {
      await unmarkMatch(tx, {
        groupId,
        userId,
        tmdbId,
        wantedAt: mine.wantedAt,
      });
    }
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
          isNull(groupMovie.favoriteAt),
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

const UNDO = { keep: undoKeep, reject: undoReject } as const;

export function createDecisions(db: Database): Decisions {
  return {
    swipe: (input) =>
      input.decision === "keep" ? keep(db, input) : reject(db, input),

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
