import { and, count, eq, isNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Executor } from "./create-database";
import { groupMovie, membership, movieWant } from "./group-schema";
import { listRow, wishesOf } from "./list-queries";

interface MatchInput {
  groupId: string;
  userId: string;
  tmdbId: number;
}

const member = alias(membership, "member");

/**
 * One statement, in the swipe's transaction: the movie becomes a match iff
 * it is « à voir », not a match yet, the group has at least two members and
 * none of them lacks a wish on it. `now` is the wanted_at of the wish just
 * created, which ties the match to that swipe (see unmarkMatch). True iff
 * this call made the match: of two racing swipes, only one gets a row back.
 */
export async function markMatch(
  tx: Executor,
  input: MatchInput & { now: Date },
): Promise<boolean> {
  const { groupId, userId, tmdbId, now } = input;
  const members = tx
    .select({ n: count() })
    .from(membership)
    .where(eq(membership.groupId, groupId));
  const memberWithoutWish = tx
    .select({ one: sql`1` })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(movieWant)
            .where(
              and(
                wishesOf(groupId, tmdbId),
                eq(movieWant.userId, member.userId),
              ),
            ),
        ),
      ),
    );
  const matched = await tx
    .update(groupMovie)
    .set({ matchedAt: now, matchedBy: userId })
    .where(
      and(
        listRow(groupId, tmdbId),
        eq(groupMovie.status, "to_watch"),
        isNull(groupMovie.matchedAt),
        sql`${members} >= 2`,
        notExists(memberWithoutWish),
      ),
    )
    .returning({ id: groupMovie.tmdbId });
  return matched.length > 0;
}

/**
 * « ↺ ANNULER » of the swipe that made the match: clears it only when I made
 * it with the wish being taken back (same wanted_at), never an older match.
 */
export async function unmarkMatch(
  tx: Executor,
  input: MatchInput & { wantedAt: Date },
): Promise<void> {
  const { groupId, userId, tmdbId, wantedAt } = input;
  await tx
    .update(groupMovie)
    .set({ matchedAt: null, matchedBy: null })
    .where(
      and(
        listRow(groupId, tmdbId),
        eq(groupMovie.matchedBy, userId),
        eq(groupMovie.matchedAt, wantedAt),
      ),
    );
}
