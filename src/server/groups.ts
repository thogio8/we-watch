import "server-only";
import { cookies } from "next/headers";
import { GROUP_COOKIE, type GroupSummary } from "@/domain/group";
import { getGroups } from "./container";
import { assertSignedIn, type CurrentUser, getCurrentUser } from "./session";

export type ActiveGroup =
  | { user: CurrentUser; group: GroupSummary; groups: GroupSummary[] }
  | { user: CurrentUser; group: null; groups: [] };

const MAX_GROUP_ID_LENGTH = 64;
const ONE_YEAR_AND_A_MONTH = 400 * 24 * 60 * 60;

/**
 * The group on screen: the one the cookie names if I am a member of it,
 * else my last used one. Null when signed out; `group: null` when I belong
 * to no group yet. Reads cookies(): callers render under <Suspense>.
 */
export async function getActiveGroup(): Promise<ActiveGroup | null> {
  const user = await getCurrentUser();
  if (user === null) {
    return null;
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

/** Remembers the displayed group on this device. Server Actions only. */
export async function rememberGroup(groupId: string): Promise<void> {
  (await cookies()).set(GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_AND_A_MONTH,
    path: "/",
  });
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
    throw new Error("Server Action refused: not a member");
  }
  return { user, groupId };
}
