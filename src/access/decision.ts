import { CRON_PATH, isCronAuthorized } from "./cron";
import { AUTH_API_PREFIX, INVITATION_PREFIX, SIGNIN_PATH } from "./paths";

export type AccessDecision = "allow" | "redirect" | "unauthorized";

interface AccessRequest {
  pathname: string;
  method: string;
  /** A valid Better Auth session came with the request. */
  signedIn: boolean;
  /** Authorization header and secret of the cron route. */
  authorization?: string | null;
  cronSecret?: string;
}

/**
 * Paths readable without a session: framework assets, files from public/,
 * and the PWA manifest and icons (iOS fetches them without cookies).
 * The root static-extension rule assumes no root dynamic segment (`/[slug]`):
 * if one is added, `/anything.png` would reach it signed out, so revisit this.
 */
const PUBLIC_ASSET =
  /^(?:\/_next\/.*|\/manifest\.webmanifest|\/(?:apple-|maskable-)?icon(?:\/[^/]*)?|\/[^/]+\.(?:svg|png|jpe?g|webp|gif|ico|woff2?))$/;

function isReadOnly(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function isSigninRoute(pathname: string): boolean {
  return (
    pathname === SIGNIN_PATH ||
    pathname.startsWith(AUTH_API_PREFIX) ||
    pathname.startsWith(INVITATION_PREFIX)
  );
}

/** What the proxy does with a request, given whether it carries a session. */
export function accessDecision({
  pathname,
  method,
  signedIn,
  authorization,
  cronSecret,
}: AccessRequest): AccessDecision {
  // The cron route answers its secret only, never a session.
  if (pathname === CRON_PATH) {
    return isReadOnly(method) && isCronAuthorized(authorization, cronSecret)
      ? "allow"
      : "unauthorized";
  }
  // Signing in happens there: the pages, their Server Actions, Better Auth.
  if (isSigninRoute(pathname)) {
    return "allow";
  }
  if (isReadOnly(method) && PUBLIC_ASSET.test(pathname)) {
    return "allow";
  }
  if (signedIn) {
    return "allow";
  }
  // Pages go to the form; Server Action POSTs cannot follow a redirect.
  return isReadOnly(method) ? "redirect" : "unauthorized";
}

/**
 * Reads the session only when it changes the answer: public assets, the
 * sign-in routes and the cron are decided without touching the database.
 */
export async function decideAccess(
  request: Omit<AccessRequest, "signedIn">,
  isSignedIn: () => Promise<boolean>,
): Promise<AccessDecision> {
  const signedOut = accessDecision({ ...request, signedIn: false });
  if (signedOut === accessDecision({ ...request, signedIn: true })) {
    return signedOut;
  }
  return accessDecision({ ...request, signedIn: await isSignedIn() });
}
