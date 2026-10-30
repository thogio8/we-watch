import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./create-database";
import { group } from "./group-schema";

export interface Invitations {
  /** The group's invite token, created on first demand. */
  ensureInvite(groupId: string): Promise<string>;
  /** A new token: the previous link stops working. */
  regenerateInvite(groupId: string): Promise<string>;
  findByInvite(token: string): Promise<{ id: string; name: string } | null>;
}

/** 32 random bytes in base64url: 43 characters (see isInviteToken). */
function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  );
}

export function createInvitations(db: Database): Invitations {
  async function tokenOf(groupId: string): Promise<string> {
    const [row] = await db
      .select({ token: group.inviteToken })
      .from(group)
      .where(eq(group.id, groupId));
    if (!row?.token) throw new Error(`unknown group ${groupId}`);
    return row.token;
  }

  return {
    async ensureInvite(groupId) {
      await db
        .update(group)
        .set({ inviteToken: newToken() })
        .where(and(eq(group.id, groupId), isNull(group.inviteToken)));
      return tokenOf(groupId);
    },

    async regenerateInvite(groupId) {
      await db
        .update(group)
        .set({ inviteToken: newToken() })
        .where(eq(group.id, groupId));
      return tokenOf(groupId);
    },

    async findByInvite(token) {
      const [row] = await db
        .select({ id: group.id, name: group.name })
        .from(group)
        .where(eq(group.inviteToken, token));
      return row ?? null;
    },
  };
}
