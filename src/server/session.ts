import "server-only";
import { headers } from "next/headers";
import { logSessionFailure } from "@/access/signed-in";
import { getAuth } from "./container";

export type CurrentUser = { userId: string; name: string };

/**
 * The signed-in user of the current request, or null. A session that cannot
 * be read (database down, session deleted mid-refresh) counts as none, so an
 * action is refused as signed out rather than failing with a raw 500.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const requestHeaders = await headers();
  try {
    const session = await getAuth().api.getSession({
      headers: requestHeaders,
    });
    return session === null
      ? null
      : { userId: session.user.id, name: session.user.name };
  } catch (error) {
    logSessionFailure("Session read failed", error);
    return null;
  }
}

/**
 * First line of every Server Action: the proxy already refuses them without
 * a session, but actions are public endpoints and may be forwarded across
 * routes by Next, so each one checks the session itself (defence in depth).
 */
export async function assertSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user === null) {
    throw new Error("Server Action refused: not signed in");
  }
  return user;
}
