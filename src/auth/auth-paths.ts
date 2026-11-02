import type { BetterAuthPlugin } from "better-auth";

// The only Better Auth paths the app uses: sign-out (SignOutButton) and the
// two passkey ceremonies of the browser client (signIn.passkey, addPasskey:
// sign-up and « AJOUTER UNE CLÉ »). Every other path answers 404
// (onlyAuthPaths), /get-session included: the client never reads the
// session, pages and the proxy call auth.api directly, which no router
// plugin sees. The attempt limits count none of them either (rate-limits.ts).

/** Where Better Auth is mounted (src/app/api/auth/[...all]/route.ts). */
const BASE_PATH = "/api/auth";

// Piece 4 (Google) adds its own paths here.
export const AUTH_PATHS = [
  "/sign-out",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
] as const;

const OPEN: ReadonlySet<string> = new Set(AUTH_PATHS);

/** A path, as authPathOf gives it, the app serves. */
export function isAuthPath(path: string): boolean {
  return OPEN.has(path);
}

/**
 * The Better Auth path of a request URL, normalised as Better Auth matches
 * its rules (normalizePathname of @better-auth/core): base path and trailing
 * slashes removed, "/" for an unreadable URL.
 */
export function authPathOf(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
  if (pathname === BASE_PATH) return "/";
  // No trailing slash is left: the rest is never empty.
  return pathname.startsWith(`${BASE_PATH}/`)
    ? pathname.slice(BASE_PATH.length)
    : pathname;
}

/**
 * Better Auth answers 404 on every path outside AUTH_PATHS, before any
 * endpoint or hook runs. The rate limit runs before plugins but skips these
 * paths (its "/**" rule), so they write nothing either. Only `{ response }`
 * stops the router: a bare Response would be ignored.
 */
export const onlyAuthPaths = {
  id: "only-auth-paths",
  onRequest: async (request: Request) =>
    isAuthPath(authPathOf(request.url))
      ? undefined
      : { response: new Response("Not Found", { status: 404 }) },
} satisfies BetterAuthPlugin;
