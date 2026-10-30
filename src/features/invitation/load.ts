import "server-only";
import { getGroups } from "@/server/container";
import { findInvitedGroup } from "@/server/invitations";
import { getCurrentUser } from "@/server/session";

export type Invitation =
  | { state: "invalid" }
  | { state: "signed_out"; groupName: string }
  | { state: "join"; groupName: string }
  | { state: "member"; groupId: string; groupName: string };

/**
 * What an invite link opens. The token is resolved first, so an invalid link
 * (malformed, unknown, regenerated, group deleted) gets the same answer
 * whoever opens it, and reveals nothing.
 */
export async function loadInvitation(token: unknown): Promise<Invitation> {
  const group = await findInvitedGroup(token);
  if (group === null) return { state: "invalid" };
  const user = await getCurrentUser();
  if (user === null) return { state: "signed_out", groupName: group.name };
  return (await getGroups().isMember(group.id, user.userId))
    ? { state: "member", groupId: group.id, groupName: group.name }
    : { state: "join", groupName: group.name };
}
