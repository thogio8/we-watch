/**
 * How long after signing in a session may still do what could lock its
 * owner out (add or delete a passkey, delete the account). Sessions last
 * 60 days: past this, the device lock is asked again.
 */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

/** Whether a session opened at `signedInAt` is still recent at `now`. */
export function isRecentSignIn(signedInAt: Date, now: Date): boolean {
  return now.getTime() - signedInAt.getTime() < RECENT_SIGN_IN_SECONDS * 1000;
}

/**
 * The code Better Auth's own freshness check answers with (HTTP 403): the
 * passkey registration refuses an old session with it too.
 */
export const STALE_SESSION_CODE = "SESSION_NOT_FRESH";

/** A Better Auth client error refused because the session is not recent. */
export function isStaleSession(error: object | null | undefined): boolean {
  return Boolean(
    error &&
    "status" in error &&
    error.status === 403 &&
    "code" in error &&
    error.code === STALE_SESSION_CODE,
  );
}
