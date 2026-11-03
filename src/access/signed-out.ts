import { SIGNIN_PATH } from "./paths";

/**
 * Carried by a Server Action refused for want of a session. In production,
 * Next hides a thrown error's message from the client but keeps a digest
 * the error already has: the client recognises the refusal by it.
 */
const SIGNED_OUT_DIGEST = "WEWATCH_SIGNED_OUT";

/** Thrown by assertSignedIn (server/session.ts). */
export function signedOutRefusal(): Error & { digest: string } {
  return Object.assign(new Error("Server Action refused: not signed in"), {
    digest: SIGNED_OUT_DIGEST,
  });
}

/**
 * On the client, wherever an action's failure is caught: refused for want
 * of a session (revoked from another device), this device goes to the
 * sign-in page, a full load that drops the pages it kept. Anything else
 * stays the caller's to show.
 */
export function leaveIfSignedOut(error: unknown): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    error.digest === SIGNED_OUT_DIGEST
  ) {
    window.location.replace(SIGNIN_PATH);
  }
}
