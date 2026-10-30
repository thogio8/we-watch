import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { user } from "./auth-schema";
import type { Database, Executor } from "./create-database";
import { group, groupMovie, membership, movieWant } from "./group-schema";

type Member = { userId: string; name: string; joinedAt: Date };

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
  leave(
    groupId: string,
    userId: string,
  ): Promise<"left" | "group_deleted" | "not_member">;
}

export const membershipOf = (groupId: string, userId: string) =>
  and(eq(membership.groupId, groupId), eq(membership.userId, userId));

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

export function createMemberships(db: Database): Memberships {
  return {
    async join(groupId, userId, now = new Date()) {
      const at = now.getTime();
      const inserted = await db.run(sql`
        insert into ${membership} (group_id, user_id, joined_at, last_used_at)
        select ${groupId}, ${userId}, ${at}, ${at}
        where exists (select 1 from ${group} where ${group.id} = ${groupId})
        on conflict do nothing`);
      if (inserted.rowsAffected > 0) return "joined";
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
      return db.transaction(async (tx) => {
        const left = await tx
          .delete(membership)
          .where(membershipOf(groupId, userId));
        if (left.rowsAffected === 0) return "not_member";
        await tx
          .delete(movieWant)
          .where(
            and(eq(movieWant.groupId, groupId), eq(movieWant.userId, userId)),
          );
        return (await deleteIfEmpty(tx, groupId)) ? "group_deleted" : "left";
      });
    },
  };
}
