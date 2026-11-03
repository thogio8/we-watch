import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/access/paths";
import { notMemberRefusal } from "@/access/refusals";
import {
  GROUP_COOKIE,
  groupCookieAttributes,
  type GroupSummary,
} from "@/domain/group";
import { getServerEnv } from "@/env";
import { getGroups } from "./container";
import { assertSignedIn, type CurrentUser, getCurrentUser } from "./session";

export type ActiveGroup =
  | { user: CurrentUser; group: GroupSummary; groups: GroupSummary[] }
  | { user: CurrentUser; group: null; groups: [] };

const MAX_GROUP_ID_LENGTH = 64;
const ONE_YEAR_AND_A_MONTH = 400 * 24 * 60 * 60;

/**
 * For pages: the group on screen, the one the cookie names if I am a member
 * of it, else my last used one; `group: null` when I belong to no group yet.
 * Signed out (a session revoked since the proxy let the request through),
 * redirects to the sign-in page. Reads cookies(): callers render under
 * <Suspense>.
 */
export async function getActiveGroup(): Promise<ActiveGroup> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(SIGNIN_PATH);
  }
  const groups = await getGroups().groupsOf(user.userId);
  const [first] = groups;
  if (first === undefined) {
    return { user, group: null, groups: [] };
  }
  // Never trusted alone: only a group of mine is kept.
  const remembered = (await cookies()).get(GROUP_COOKIE)?.value;
  const group = groups.find((g) => g.id === remembered) ?? first;
  return { user, group, groups };
}

/** GROUP_COOKIE's attributes on this deployment (secure over https). */
const groupCookie = () => groupCookieAttributes(getServerEnv().BETTER_AUTH_URL);

/** Remembers the displayed group on this device. Server Actions only. */
export async function rememberGroup(groupId: string): Promise<void> {
  (await cookies()).set(GROUP_COOKIE, groupId, {
    ...groupCookie(),
    maxAge: ONE_YEAR_AND_A_MONTH,
  });
}

/** Expires the displayed group on this device. Server Actions only. */
export async function clearGroup(): Promise<void> {
  (await cookies()).set(GROUP_COOKIE, "", { ...groupCookie(), maxAge: 0 });
}

/** Forgets the displayed group when it is `groupId` (left or removed). Server Actions only. */
export async function forgetGroup(groupId: string): Promise<void> {
  if ((await cookies()).get(GROUP_COOKIE)?.value === groupId) {
    await clearGroup();
  }
}

const isGroupId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_GROUP_ID_LENGTH;

/**
 * For reads (pages): whether the signed-in user belongs to `groupId`. False
 * when signed out or for a forged id, without asking the database.
 */
export async function isMemberOf(groupId: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  return (
    user !== null &&
    isGroupId(groupId) &&
    getGroups().isMember(groupId, user.userId)
  );
}

/**
 * First line of every Server Action on a group (session included): a forged or foreign
 * groupId is refused before anything is read or written.
 */
export async function assertMember(
  groupId: unknown,
): Promise<{ user: CurrentUser; groupId: string }> {
  const user = await assertSignedIn();
  if (
    !isGroupId(groupId) ||
    !(await getGroups().isMember(groupId, user.userId))
  ) {
    throw notMemberRefusal();
  }
  return { user, groupId };
}
