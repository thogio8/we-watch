"use server";

import { revalidatePath } from "next/cache";
import { getAccount } from "@/server/container";
import { assertSignedIn } from "@/server/session";
import { assertId } from "@/server/validate";
import { LAST_PASSKEY, UNNAMED_PASSKEY } from "./messages";

export type MyPasskey = { id: string; name: string; createdAt: Date | null };

/** « TES CLÉS D’ACCÈS »: mine only, named after the device that made them. */
export async function listMyPasskeys(): Promise<MyPasskey[]> {
  const { userId } = await assertSignedIn();
  const rows = await getAccount().passkeysOf(userId);
  return rows.map((row) => ({ ...row, name: row.name ?? UNNAMED_PASSKEY }));
}

export type DeletePasskeyResult = { ok: true } | { ok: false; error: string };

/**
 * « SUPPRIMER » a passkey of mine. The last one is kept (expected, shown);
 * someone else's or an unknown id is refused without any write.
 */
export async function deletePasskey(id: string): Promise<DeletePasskeyResult> {
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
