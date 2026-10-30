"use server";

import { getServerEnv } from "@/env";
import { parseGroupName } from "@/domain/group";
import { getGroups } from "@/server/container";
import { assertMember, forgetGroup, rememberGroup } from "@/server/groups";
import { findInvitedGroup } from "@/server/invitations";
import { revalidatePath } from "next/cache";
import { revalidateGroupPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { GROUP_NAME_ERROR, INVITE_INVALID } from "./messages";

export type CreateGroupResult =
  { ok: true; groupId: string } | { ok: false; error: string };

/** « CRÉER LE GROUPE »: I am its first member, and it is displayed. */
export async function createGroup(
  formData: FormData,
): Promise<CreateGroupResult> {
  const { userId } = await assertSignedIn();
  // A public endpoint: anything may come in place of the form.
  const name =
    formData instanceof FormData ? parseGroupName(formData.get("name")) : null;
  if (name === null) {
    return { ok: false, error: GROUP_NAME_ERROR };
  }
  const { id } = await getGroups().create({ name, userId });
  await rememberGroup(id);
  revalidateGroupPages();
  return { ok: true, groupId: id };
}

/** A group picked in the pill's panel becomes the displayed one. */
export async function chooseGroup(groupId: string): Promise<void> {
  const { user } = await assertMember(groupId);
  await rememberGroup(groupId);
  await getGroups().touch(groupId, user.userId);
  revalidateGroupPages();
}

type Outcome = { ok: true } | { ok: false; error: string };

/** « RENOMMER »: any member may. */
export async function renameGroup(
  groupId: string,
  formData: FormData,
): Promise<Outcome> {
  await assertMember(groupId);
  const name =
    formData instanceof FormData ? parseGroupName(formData.get("name")) : null;
  if (name === null) {
    return { ok: false, error: GROUP_NAME_ERROR };
  }
  await getGroups().rename(groupId, name);
  revalidateGroupPages();
  return { ok: true };
}

/** The full link: its origin comes from the environment, never the request. */
function linkOf(token: string): string {
  return new URL(`/invitation/${token}`, getServerEnv().BETTER_AUTH_URL).href;
}

/** A read, but an action: the first call creates the token. */
export async function inviteLink(groupId: string): Promise<string> {
  await assertMember(groupId);
  return linkOf(await getGroups().ensureInvite(groupId));
}

/** « RÉGÉNÉRER LE LIEN »: the previous link stops working. */
export async function regenerateInviteLink(groupId: string): Promise<string> {
  await assertMember(groupId);
  const token = await getGroups().regenerateInvite(groupId);
  revalidatePath("/groupe");
  return linkOf(token);
}

async function leave(groupId: string, userId: string, me: string) {
  await getGroups().leave(groupId, userId);
  if (userId === me) {
    await forgetGroup(groupId);
  }
  revalidateGroupPages();
  revalidatePath("/groupe");
}

/** « RETIRER »: any member may remove any member, themselves included. */
export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { user } = await assertMember(groupId);
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 64) {
    throw new Error("removeMember: invalid userId");
  }
  await leave(groupId, userId, user.userId);
}

/** « QUITTER LE GROUPE ». */
export async function leaveGroup(groupId: string): Promise<void> {
  const { user } = await assertMember(groupId);
  await leave(groupId, user.userId, user.userId);
}

export type JoinGroupResult =
  { ok: true; groupId: string } | { ok: false; error: string };

/** Opening an invite link: I join the group, which is displayed. */
export async function joinGroup(token: string): Promise<JoinGroupResult> {
  const { userId } = await assertSignedIn();
  const found = await findInvitedGroup(token);
  if (found === null) {
    return { ok: false, error: INVITE_INVALID };
  }
  if ((await getGroups().join(found.id, userId)) === "gone") {
    return { ok: false, error: INVITE_INVALID };
  }
  await rememberGroup(found.id);
  // "already" does not touch the membership: opening the link still switches.
  await getGroups().touch(found.id, userId);
  revalidateGroupPages();
  revalidatePath("/groupe");
  return { ok: true, groupId: found.id };
}
