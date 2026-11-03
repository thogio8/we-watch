import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { deleteUserIn } from "./account-deletion";
import { passkey, session } from "./auth-schema";
import type { Database } from "./create-database";

interface PasskeyRow {
  id: string;
  /** Set by the server at registration (deviceLabel); older ones have none. */
  name: string | null;
  createdAt: Date | null;
}

interface SessionRow {
  id: string;
  userAgent: string | null;
  /** Last activity: set when Better Auth extends the session. */
  updatedAt: Date;
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
  /** My sessions not expired at `now`, last active first; never the token. */
  sessionsOf(userId: string, now?: Date): Promise<SessionRow[]>;
  /** Signs out my session `id`; false (nothing written) when not mine. */
  deleteSession(userId: string, id: string): Promise<boolean>;
  /** My account and everything mine alone: see deleteUserIn. */
  deleteUser(userId: string): Promise<boolean>;
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

    sessionsOf(userId, now = new Date()) {
      return db
        .select({
          id: session.id,
          userAgent: session.userAgent,
          updatedAt: session.updatedAt,
        })
        .from(session)
        .where(and(eq(session.userId, userId), gt(session.expiresAt, now)))
        .orderBy(desc(session.updatedAt), asc(session.id));
    },

    async deleteSession(userId, id) {
      const deleted = await db
        .delete(session)
        .where(and(eq(session.id, id), eq(session.userId, userId)));
      return deleted.rowsAffected > 0;
    },

    deleteUser: (userId) => deleteUserIn(db, userId),
  };
}
