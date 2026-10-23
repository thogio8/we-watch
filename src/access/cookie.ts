/** Cookie that remembers an unlocked device; its value is the access token. */
export const ACCESS_COOKIE = "ww_access";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function accessCookieOptions({ secure }: { secure: boolean }) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  } as const;
}
