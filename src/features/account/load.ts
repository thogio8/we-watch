import "server-only";
import { deviceLabel } from "@/domain/device";
import { getAccount } from "@/server/container";
import { UNNAMED_PASSKEY } from "./messages";

export type MyPasskey = { id: string; name: string; createdAt: Date | null };

/**
 * « TES CLÉS D’ACCÈS »: mine only, named after the device that made them.
 * Not an action: the /compte page calls it for the user it already read.
 */
export async function listMyPasskeys(userId: string): Promise<MyPasskey[]> {
  const rows = await getAccount().passkeysOf(userId);
  return rows.map((row) => ({ ...row, name: row.name ?? UNNAMED_PASSKEY }));
}

export type MySession = {
  id: string;
  device: string;
  lastActiveAt: Date;
  /** « CET APPAREIL »: the session of this request. */
  current: boolean;
};

/** « TES APPAREILS »: my signed-in devices, never their session token. */
export async function listMySessions(
  userId: string,
  currentSessionId: string,
): Promise<MySession[]> {
  const rows = await getAccount().sessionsOf(userId);
  return rows.map(({ id, userAgent, updatedAt }) => ({
    id,
    device: deviceLabel(userAgent),
    lastActiveAt: updatedAt,
    current: id === currentSessionId,
  }));
}
