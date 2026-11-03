import type { SignupTicket } from "@/access/signup-ticket";
import { insertMembership } from "@/db/membership";
import { LEGACY_GROUP_ID } from "@/domain/group";
import { currentTransaction } from "./signup-transaction";

export type SignupJoin = { groupId: string; lastUsedAt: Date | null };

/**
 * The groups a new account joins: the invitation's, displayed first (decision
 * 3), and « NOUS DEUX » for the owner, the list kept from before accounts.
 * Displayed only when there is no invitation; once only when the invitation
 * is to « NOUS DEUX » itself.
 */
export function signupJoins(
  { owner, invite }: Pick<SignupTicket, "owner" | "invite">,
  now: Date,
): SignupJoin[] {
  const joins: SignupJoin[] = [];
  if (invite !== null) {
    joins.push({ groupId: invite, lastUsedAt: now });
  }
  if (owner && invite !== LEGACY_GROUP_ID) {
    joins.push({
      groupId: LEGACY_GROUP_ID,
      lastUsedAt: invite === null ? now : null,
    });
  }
  return joins;
}

/**
 * The new account joins a group, in the signup transaction: a signup that
 * fails later (passkey already registered…) rolls the membership back with
 * the user. One conditional insert, never a read then a write: a group
 * deleted since the ticket was issued (or a fresh instance without « NOUS
 * DEUX ») leaves the account without membership, and the signup succeeds.
 */
export async function joinGroupInSignup(
  userId: string,
  { groupId, lastUsedAt }: SignupJoin,
  now: Date,
): Promise<void> {
  await insertMembership(currentTransaction(), {
    groupId,
    userId,
    joinedAt: now,
    lastUsedAt,
  });
}
