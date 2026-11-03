import { isTooManyAttempts, TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import { authClient } from "@/features/signin/authClient";
import { CONFIRM_WITH_PASSKEY } from "./messages";

/** This device's session, and how to sign it out once replaced. */
export interface Reconfirm {
  /** « CET APPAREIL » in « TES APPAREILS ». */
  sessionId: string | undefined;
  /** revokeSession (features/account/actions.ts). */
  revoke: (id: string) => Promise<boolean>;
}

/** The attempt's outcome, or why it was not replayed (a text to show). */
export type Confirmed<T> =
  { done: true; outcome: T } | { done: false; error: string };

/** A Server Action's refusal for a session not recent enough. */
export const refusedAsStale = (result: object): boolean =>
  "reason" in result && result.reason === "stale";

/** The device lock again: null once signed in anew, else the text to show. */
async function signInAgain(): Promise<string | null> {
  const result = await authClient.signIn.passkey().catch(() => null);
  if (result !== null && !result.error) {
    return null;
  }
  return isTooManyAttempts(result?.error)
    ? TOO_MANY_ATTEMPTS
    : CONFIRM_WITH_PASSKEY;
}

/**
 * Runs `attempt`; refused for a session opened too long ago (`isStale`),
 * asks the device lock (a passkey sign-in, offered this account's keys
 * only: the plugin lists the session's), signs the old session out, then
 * replays `attempt` once, so nothing is tapped twice. A sign-in opens a new
 * session: without the revocation, this device would show twice in « TES
 * APPAREILS ». The displayed group (its cookie) and the screen stay as they
 * are. A failure of revoke or of the attempt is thrown, as the action's.
 */
export async function confirmThenReplay<T>(
  attempt: () => Promise<T>,
  isStale: (outcome: T) => boolean,
  { sessionId, revoke }: Reconfirm,
): Promise<Confirmed<T>> {
  const first = await attempt();
  if (!isStale(first)) {
    return { done: true, outcome: first };
  }
  const error = await signInAgain();
  if (error !== null) {
    return { done: false, error };
  }
  // Not mine (another account's key) or gone: nothing is replayed.
  if (sessionId !== undefined && !(await revoke(sessionId))) {
    return { done: false, error: CONFIRM_WITH_PASSKEY };
  }
  return { done: true, outcome: await attempt() };
}
