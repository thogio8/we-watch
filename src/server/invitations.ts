import "server-only";
import { isInviteToken } from "@/domain/group";
import { getGroups } from "./container";

/**
 * The group an invite token opens, or null: malformed, unknown, regenerated
 * or deleted all look the same. A malformed token never reaches the database,
 * and a failure is rethrown without its message nor cause, which may quote
 * the token (Next logs a thrown error).
 */
export async function findInvitedGroup(
  token: unknown,
): Promise<{ id: string; name: string } | null> {
  if (!isInviteToken(token)) return null;
  try {
    return await getGroups().findByInvite(token);
  } catch {
    throw new Error("findInvitedGroup: lookup failed");
  }
}
