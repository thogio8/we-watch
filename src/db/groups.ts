import { and, asc, eq, sql } from "drizzle-orm";
import type { GroupSummary } from "@/domain/group";
import type { Database } from "./create-database";
import { group, membership } from "./group-schema";

interface CreateInput {
  name: string;
  userId: string;
  now?: Date;
}

export interface Groups {
  /** A new group whose creator is the only member, just used. */
  create(input: CreateInput): Promise<GroupSummary>;
  /** Last used first (never used last), then the oldest joined. */
  groupsOf(userId: string): Promise<GroupSummary[]>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  /** Remembers that the member displayed this group. */
  touch(groupId: string, userId: string, now?: Date): Promise<void>;
}

const membershipOf = (groupId: string, userId: string) =>
  and(eq(membership.groupId, groupId), eq(membership.userId, userId));

export function createGroups(db: Database): Groups {
  return {
    async create({ name, userId, now = new Date() }) {
      const id = crypto.randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(group).values({ id, name, createdAt: now });
        await tx
          .insert(membership)
          .values({ groupId: id, userId, joinedAt: now, lastUsedAt: now });
      });
      return { id, name, memberCount: 1 };
    },

    groupsOf(userId) {
      return db
        .select({
          id: group.id,
          name: group.name,
          memberCount: db.$count(membership, eq(membership.groupId, group.id)),
        })
        .from(membership)
        .innerJoin(group, eq(group.id, membership.groupId))
        .where(eq(membership.userId, userId))
        .orderBy(
          sql`${membership.lastUsedAt} desc nulls last`,
          asc(membership.joinedAt),
          asc(group.id),
        );
    },

    async isMember(groupId, userId) {
      return (await db.$count(membership, membershipOf(groupId, userId))) > 0;
    },

    async touch(groupId, userId, now = new Date()) {
      await db
        .update(membership)
        .set({ lastUsedAt: now })
        .where(membershipOf(groupId, userId));
    },
  };
}
