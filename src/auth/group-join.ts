import { insertMembership } from "@/db/membership";
import { currentTransaction } from "./signup-transaction";

/**
 * A new account invited by a link joins that group, displayed (decision 3),
 * in the signup transaction: a signup that fails later (passkey already
 * registered…) rolls the membership back with the user. One conditional
 * insert, never a read then a write: a group deleted since the ticket was
 * issued leaves the account without membership, and the signup succeeds.
 */
export async function joinInvitedGroup(
  userId: string,
  groupId: string,
  now: Date,
): Promise<void> {
  await insertMembership(currentTransaction(), { groupId, userId, now });
}
