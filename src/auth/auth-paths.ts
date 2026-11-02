// The only Better Auth paths the app uses (sign-out and the passkey
// ceremonies). No other path is counted by the attempt limits
// (rate-limits.ts); piece 6 (task 3a) will stop serving them too.

/** Where Better Auth is mounted (src/app/api/auth/[...all]/route.ts). */
const BASE_PATH = "/api/auth";

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
