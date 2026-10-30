import "server-only";
import { isInviteToken } from "@/domain/group";
import { getGroups } from "./container";

/**
 * The group an invite token opens, or null: malformed, unknown, regenerated
 * or deleted all look the same. A malformed token never reaches the database.
 */
export async function findInvitedGroup(
  token: unknown,
): Promise<{ id: string; name: string } | null> {
  return isInviteToken(token) ? getGroups().findByInvite(token) : null;
}
