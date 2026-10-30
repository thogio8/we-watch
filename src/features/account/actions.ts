"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { deviceLabel } from "@/domain/device";
import { confirmsName, parseDisplayName } from "@/domain/display-name";
import { NAME_ERROR } from "@/features/signin/messages";
import { getAccount, getAuth } from "@/server/container";
import { revalidateListPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { signOutThisDevice } from "@/server/sign-out";
import { assertId } from "@/server/validate";
import { LAST_PASSKEY, UNNAMED_PASSKEY, WRONG_NAME } from "./messages";

export type MyPasskey = { id: string; name: string; createdAt: Date | null };

/** « TES CLÉS D’ACCÈS »: mine only, named after the device that made them. */
export async function listMyPasskeys(): Promise<MyPasskey[]> {
  const { userId } = await assertSignedIn();
  const rows = await getAccount().passkeysOf(userId);
  return rows.map((row) => ({ ...row, name: row.name ?? UNNAMED_PASSKEY }));
}

export type AccountResult = { ok: true } | { ok: false; error: string };

/**
 * « SUPPRIMER » a passkey of mine. The last one is kept (expected, shown);
 * someone else's or an unknown id is refused without any write.
 */
export async function deletePasskey(id: string): Promise<AccountResult> {
  const { userId } = await assertSignedIn();
  assertId("deletePasskey", id);
  const outcome = await getAccount().deletePasskey(userId, id);
  if (outcome === "last") {
    return { ok: false, error: LAST_PASSKEY };
  }
  if (outcome === "not_found") {
    throw new Error("deletePasskey: not found");
  }
  revalidatePath("/compte");
  return { ok: true };
}

export type MySession = {
  id: string;
  device: string;
  lastActiveAt: Date;
  /** « CET APPAREIL »: the session of this request. */
  current: boolean;
};

/** « TES APPAREILS »: my signed-in devices, never their session token. */
export async function listMySessions(): Promise<MySession[]> {
  const { userId, sessionId } = await assertSignedIn();
  const rows = await getAccount().sessionsOf(userId);
  return rows.map(({ id, userAgent, updatedAt }) => ({
    id,
    device: deviceLabel(userAgent),
    lastActiveAt: updatedAt,
    current: id === sessionId,
  }));
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
