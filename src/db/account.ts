import { and, asc, eq, sql } from "drizzle-orm";
import { passkey } from "./auth-schema";
import type { Database } from "./create-database";

interface PasskeyRow {
  id: string;
  /** Set by the server at registration (deviceLabel); older ones have none. */
  name: string | null;
  createdAt: Date | null;
}

type DeletePasskeyOutcome = "deleted" | "last" | "not_found";

/** « MON COMPTE »: what a user sees and removes of their own account. */
export interface Account {
  /** My passkeys, oldest first. */
  passkeysOf(userId: string): Promise<PasskeyRow[]>;
  /**
   * Deletes my passkey `id`, never my last one: without another way in
   * (no password, no Google yet), that would lock me out for good.
   */
  deletePasskey(userId: string, id: string): Promise<DeletePasskeyOutcome>;
}

const mine = (userId: string, id: string) =>
  and(eq(passkey.id, id), eq(passkey.userId, userId));

export function createAccount(db: Database): Account {
  return {
    passkeysOf(userId) {
      return db
        .select({
          id: passkey.id,
          name: passkey.name,
          createdAt: passkey.createdAt,
        })
        .from(passkey)
        .where(eq(passkey.userId, userId))
        .orderBy(asc(passkey.createdAt), asc(passkey.id));
    },

    async deletePasskey(userId, id) {
      // One statement, so two deletions at once cannot both see two
      // passkeys and remove them both.
      const deleted = await db
        .delete(passkey)
        .where(
          and(
            mine(userId, id),
            sql`(SELECT count(*) FROM ${passkey} WHERE ${passkey.userId} = ${userId}) > 1`,
          ),
        )
        .returning({ id: passkey.id });
      if (deleted.length > 0) {
        return "deleted";
      }
      return (await db.$count(passkey, mine(userId, id))) > 0
        ? "last"
        : "not_found";
    },
  };
}
