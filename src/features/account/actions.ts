"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { confirmsName, parseDisplayName } from "@/domain/display-name";
import { NAME_ERROR } from "@/features/signin/messages";
import { getAccount, getAuth } from "@/server/container";
import { revalidateListPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { signOutThisDevice } from "@/server/sign-out";
import { assertId } from "@/server/validate";
import { WRONG_NAME } from "./messages";

export type AccountResult = { ok: true } | { ok: false; error: string };

export type DeletePasskeyResult =
  { ok: true } | { ok: false; reason: "last" | "not_found" };

/**
 * « SUPPRIMER » a passkey of mine. Both refusals are expected and told apart
 * by the client: the last one is kept; someone else's, an unknown one or one
 * already deleted (another tab) is "not_found". No write either way; only an
 * unexpected failure (network, database) throws.
 */
export async function deletePasskey(id: string): Promise<DeletePasskeyResult> {
  const { userId } = await assertSignedIn();
  assertId("deletePasskey", id);
  const outcome = await getAccount().deletePasskey(userId, id);
  if (outcome !== "deleted") {
    return { ok: false, reason: outcome };
  }
  revalidatePath("/compte");
  return { ok: true };
}

/**
 * « DÉCONNECTER » a device of mine. This one: signs out here too, the
 * client then goes to /connexion. False, without any write, when the
 * session is not mine or no longer exists.
 */
export async function revokeSession(id: string): Promise<boolean> {
  const { userId, sessionId } = await assertSignedIn();
  assertId("revokeSession", id);
  if (!(await getAccount().deleteSession(userId, id))) {
    return false;
  }
  if (id === sessionId) {
    await signOutThisDevice();
  }
  revalidatePath("/compte");
  return true;
}

const field = (formData: unknown, name: string) =>
  formData instanceof FormData ? formData.get(name) : null;

/**
 * « TON PRÉNOM »: through Better Auth (its hook normalises the name, and the
 * session cache cookie is refreshed); /update-user is closed over HTTP only.
 */
export async function renameMe(formData: FormData): Promise<AccountResult> {
  await assertSignedIn();
  const name = parseDisplayName(field(formData, "name"));
  if (name === null) {
    return { ok: false, error: NAME_ERROR };
  }
  await getAuth().api.updateUser({ headers: await headers(), body: { name } });
  revalidateListPages();
  revalidatePath("/compte");
  return { ok: true };
}

/**
 * « SUPPRIMER DÉFINITIVEMENT », once my name is typed (confirmsName): my account and
 * everything mine alone (db/account-deletion.ts), then this device is
 * signed out; the client goes to /connexion.
 */
export async function deleteAccount(
  formData: FormData,
): Promise<AccountResult> {
  const { userId, name } = await assertSignedIn();
  if (!confirmsName(field(formData, "name"), name)) {
    return { ok: false, error: WRONG_NAME };
  }
  // Already deleted by a concurrent request (another tab): false, but the
  // end state is the same, so this device is signed out and it is ok.
  await getAccount().deleteUser(userId);
  await signOutThisDevice();
  revalidateListPages();
  return { ok: true };
}
