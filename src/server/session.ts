import "server-only";
import { headers } from "next/headers";
import { logSessionFailure } from "@/access/signed-in";
import { signedOutRefusal } from "@/access/refusals";
import { AUTHORITATIVE_SESSION_READ } from "@/auth/create-auth";
import { isRecentSignIn } from "@/domain/recent-sign-in";
import { getAuth } from "./container";

export type CurrentUser = { userId: string; name: string; sessionId: string };

type Session = { user: { id: string; name: string } } & {
  session: { id: string; createdAt: Date };
};

/**
 * The session of the current request, or null. Read from the database every
 * time, never from the signed session cache, and without writing any cookie
 * (AUTHORITATIVE_SESSION_READ): a session revoked from another device is
 * refused at once. A session that cannot be read (database down, session
 * deleted mid-refresh) counts as none, so an action is refused as signed out
 * rather than failing with a raw 500.
 */
async function readSession(): Promise<Session | null> {
  const requestHeaders = await headers();
  try {
    return await getAuth().api.getSession({
      headers: requestHeaders,
      query: AUTHORITATIVE_SESSION_READ,
    });
  } catch (error) {
    logSessionFailure("Session read failed", error);
    return null;
  }
}

const userOf = ({ user, session }: Session): CurrentUser => ({
  userId: user.id,
  name: user.name,
  sessionId: session.id,
});

/** The signed-in user of the current request, or null (see readSession). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  return session === null ? null : userOf(session);
}

async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (session === null) {
    throw signedOutRefusal();
  }
  return session;
}

/**
 * First line of every Server Action: the proxy already refuses them without
 * a session, but actions are public endpoints and may be forwarded across
 * routes by Next, so each one checks the session itself (defence in depth).
 */
export async function assertSignedIn(): Promise<CurrentUser> {
  return userOf(await requireSession());
}

/**
 * assertSignedIn for what could lock me out (deleting a passkey, the
 * account), plus whether this session was opened recently enough for it
 * (isRecentSignIn), read from the database's `createdAt`. Not recent: the
 * action answers a refusal, the client asks the device lock again.
 */
export async function assertRecentlySignedIn(
  now = new Date(),
): Promise<CurrentUser & { recent: boolean }> {
  const session = await requireSession();
  return {
    ...userOf(session),
    recent: isRecentSignIn(new Date(session.session.createdAt), now),
  };
}
