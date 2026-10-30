import "server-only";
import { getCookies } from "better-auth/cookies";
import { cookies } from "next/headers";
import { GROUP_COOKIE, groupCookieAttributes } from "@/domain/group";
import { getAuth } from "./container";

/**
 * Signs this device out once its session is gone from the database (revoked
 * here, or the whole account deleted): expires Better Auth's session cookies,
 * named and set as Better Auth does (`__Secure-` prefix over https), and the
 * displayed group, so another account on this device does not open on it.
 * Server Actions only.
 */
export async function signOutThisDevice(): Promise<void> {
  const jar = await cookies();
  const { sessionToken, sessionData, dontRememberToken } = getCookies(
    getAuth().options,
  );
  for (const { name, attributes } of [
    sessionToken,
    sessionData,
    dontRememberToken,
  ]) {
    jar.set(name, "", {
      path: attributes.path,
      httpOnly: attributes.httpOnly,
      // Better Auth's own default (create-auth.ts never overrides it).
      sameSite: "lax",
      secure: attributes.secure,
      maxAge: 0,
    });
  }
  jar.set(GROUP_COOKIE, "", {
    ...groupCookieAttributes(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });
}
