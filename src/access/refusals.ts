import { SIGNIN_PATH } from "./paths";

/**
 * Server Action refusals the client acts on. In production, Next hides a
 * thrown error's message from the client but keeps a digest the error
 * already has: the client recognises a refusal by it, and leaves the page
 * by a full load (which drops the pages it kept) for the one that fits.
 */
const REFUSALS = {
  // No session any more (revoked from another device): sign in again.
  WEWATCH_SIGNED_OUT: SIGNIN_PATH,
  // Not a member of the displayed group any more (removed by another
  // member): home shows another group of mine, or « CRÉER TON PREMIER
  // GROUPE ».
  WEWATCH_NOT_MEMBER: "/",
} as const;

type Digest = keyof typeof REFUSALS;

function refusal(message: string, digest: Digest): Error & { digest: string } {
  return Object.assign(new Error(`Server Action refused: ${message}`), {
    digest,
  });
}

/** Thrown by assertSignedIn (server/session.ts). */
export const signedOutRefusal = () =>
  refusal("not signed in", "WEWATCH_SIGNED_OUT");

/** Thrown by assertMember (server/groups.ts), session valid. */
export const notMemberRefusal = () =>
  refusal("not a member", "WEWATCH_NOT_MEMBER");

/**
 * On the client, wherever an action's failure is caught: a refusal above
 * leaves for its page. Anything else stays the caller's to show.
 */
export function leaveIfRefused(error: unknown): void {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return;
  }
  const { digest } = error;
  if (typeof digest === "string" && Object.hasOwn(REFUSALS, digest)) {
    window.location.replace(REFUSALS[digest as Digest]);
  }
}
