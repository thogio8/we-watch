"use server";

import { parseGroupName } from "@/domain/group";
import { getGroups } from "@/server/container";
import { assertMember, rememberGroup } from "@/server/groups";
import { revalidateGroupPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { GROUP_NAME_ERROR } from "./messages";

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
