import { eq } from "drizzle-orm";
import { account, passkey, session, user } from "./auth-schema";
import type { Database } from "./create-database";
import {
  groupMovie,
  membership,
  movieRejection,
  movieWant,
} from "./group-schema";
import { leaveIn } from "./membership";

/**
 * « SUPPRIMER MON COMPTE »: in one transaction (BEGIN IMMEDIATE, so no
 * write slips in between), the user leaves each of their groups as `leave`
 * does (a group left empty goes with its list), then their remaining
 * « voulu » and BOF go, the movies they added, marked watched or marked as
 * a favourite become « un ancien membre »'s, and their passkeys, sessions, accounts and user
 * row go. Every child is deleted explicitly, on this user's rows only:
 * foreign keys may be off. False when there was no such user.
 */
export function deleteUserIn(db: Database, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const groups = await tx
      .select({ id: membership.groupId })
      .from(membership)
      .where(eq(membership.userId, userId));
    for (const { id } of groups) {
      await leaveIn(tx, id, userId);
    }
    // A safety net: « voulu » outside the user's groups, whatever the data.
    await tx.delete(movieWant).where(eq(movieWant.userId, userId));
    await tx.delete(movieRejection).where(eq(movieRejection.userId, userId));
    await tx
      .update(groupMovie)
      .set({ addedBy: null })
      .where(eq(groupMovie.addedBy, userId));
    await tx
      .update(groupMovie)
      .set({ watchedBy: null })
      .where(eq(groupMovie.watchedBy, userId));
    await tx
      .update(groupMovie)
      .set({ favoriteBy: null })
      .where(eq(groupMovie.favoriteBy, userId));
    for (const table of [passkey, session, account]) {
      await tx.delete(table).where(eq(table.userId, userId));
    }
    const deleted = await tx.delete(user).where(eq(user.id, userId));
    return deleted.rowsAffected > 0;
  });
}
