import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { user } from "./auth-schema";
import type { Database, Executor } from "./create-database";
import { group, groupMovie, membership, movieWant } from "./group-schema";

type Member = { userId: string; name: string; joinedAt: Date };
type LeaveOutcome = "left" | "group_deleted" | "not_member";

export interface Memberships {
  /** Joins an existing group, just used; "gone" when it no longer exists. */
  join(
    groupId: string,
    userId: string,
    now?: Date,
  ): Promise<"joined" | "already" | "gone">;
  /** Oldest member first. */
  membersOf(groupId: string): Promise<Member[]>;
  /**
   * The member leaves and their « voulu » in the group go; the last member
   * takes the group and its list along.
   */
  leave(groupId: string, userId: string): Promise<LeaveOutcome>;
}

export const membershipOf = (groupId: string, userId: string) =>
  and(eq(membership.groupId, groupId), eq(membership.userId, userId));

type NewMembership = {
  groupId: string;
  userId: string;
  joinedAt: Date;
  lastUsedAt: Date | null;
};

/**
 * One statement: inserts the membership only while the group exists, and
 * never twice. True when a row was inserted. A group deleted concurrently
 * leaves no orphan membership, whatever the foreign keys.
 */
export async function insertMembership(
  executor: Executor,
  { groupId, userId, joinedAt, lastUsedAt }: NewMembership,
): Promise<boolean> {
  const inserted = await executor.run(sql`
    insert into ${membership} (group_id, user_id, joined_at, last_used_at)
    select ${groupId}, ${userId}, ${joinedAt.getTime()}, ${lastUsedAt?.getTime() ?? null}
    where exists (select 1 from ${group} where ${group.id} = ${groupId})
    on conflict do nothing`);
  return inserted.rowsAffected > 0;
}

/**
 * Children are deleted explicitly (foreign keys may be off) and only while
 * the group has no member, in the same statement: a join racing the last
 * departure keeps the group, never leaves an orphan membership.
 */
async function deleteIfEmpty(tx: Executor, groupId: string) {
  const empty = notExists(
    tx.select().from(membership).where(eq(membership.groupId, groupId)),
  );
  await tx.delete(movieWant).where(and(eq(movieWant.groupId, groupId), empty));
  await tx
    .delete(groupMovie)
    .where(and(eq(groupMovie.groupId, groupId), empty));
  const deleted = await tx
    .delete(group)
    .where(and(eq(group.id, groupId), empty));
  return deleted.rowsAffected > 0;
}

/**
 * `leave`, inside the caller's transaction (also used by account deletion):
 * the membership and the member's « voulu » in the group go, then the group
 * and its list if nobody is left.
 */
export async function leaveIn(
  tx: Executor,
  groupId: string,
  userId: string,
): Promise<LeaveOutcome> {
  const left = await tx.delete(membership).where(membershipOf(groupId, userId));
  if (left.rowsAffected === 0) return "not_member";
  await tx
    .delete(movieWant)
    .where(and(eq(movieWant.groupId, groupId), eq(movieWant.userId, userId)));
  return (await deleteIfEmpty(tx, groupId)) ? "group_deleted" : "left";
}

export function createMemberships(db: Database): Memberships {
  return {
    async join(groupId, userId, now = new Date()) {
      const row = { groupId, userId, joinedAt: now, lastUsedAt: now };
      if (await insertMembership(db, row)) return "joined";
      const member = await db.$count(membership, membershipOf(groupId, userId));
      return member > 0 ? "already" : "gone";
    },

    membersOf(groupId) {
      return db
        .select({
          userId: membership.userId,
          name: user.name,
          joinedAt: membership.joinedAt,
        })
        .from(membership)
        .innerJoin(user, eq(user.id, membership.userId))
        .where(eq(membership.groupId, groupId))
        .orderBy(asc(membership.joinedAt), asc(membership.userId));
    },

    leave(groupId, userId) {
      return db.transaction((tx) => leaveIn(tx, groupId, userId));
    },
  };
}
