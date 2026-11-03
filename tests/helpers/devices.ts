import { testUtils } from "better-auth/plugins";
import { createAuth } from "@/auth/create-auth";
import type { Database } from "@/db/create-database";
import { createRateLimits } from "@/db/rate-limit";
import { BASE_URL } from "./signup-ceremony";

export const AUTH_SECRET = "functional-auth-secret-0123456789abcdef";

/** The real Better Auth on `db`, with testUtils() to sign users in. */
export const aTestAuth = (db: Database) =>
  createAuth({
    db,
    secret: AUTH_SECRET,
    baseURL: BASE_URL,
    rateLimits: createRateLimits(db),
    plugins: [testUtils()],
  });

type TestAuth = ReturnType<typeof aTestAuth>;

/** A new account named `name`, signed in on a device (see aDeviceSignedInAs). */
export async function aDeviceOf(auth: TestAuth, name: string) {
  const ctx = await auth.$context;
  const account = await ctx.test.saveUser(ctx.test.createUser({ name }));
  return aDeviceSignedInAs(auth, account.id);
}

/**
 * A device signed in as `userId`, as the browser holds it, for an auth built
 * with testUtils(): the session token and the signed session cache
 * (`session_data`, valid 5 minutes) Better Auth sets.
 */
export async function aDeviceSignedInAs(auth: TestAuth, userId: string) {
  const ctx = await auth.$context;
  const login = await ctx.test.login({ userId });
  const read = await auth.api.getSession({
    headers: login.headers,
    returnHeaders: true,
  });
  const cache = read.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] as string);
  const cookies = [login.headers.get("cookie") as string, ...cache];
  return {
    userId,
    sessionId: login.session.id,
    token: login.token,
    /** `name=value` cookies, for a ceremony's requests. */
    cookies,
    headers: new Headers({ cookie: cookies.join("; ") }),
    /** The session token alone: a read must go to the database. */
    tokenOnly: login.headers,
  };
}

/**
 * Revokes `device`'s session in the database, as from another device. Its
 * session cache cookie stays valid for up to 5 minutes.
 */
export async function deleteSession(auth: TestAuth, device: { token: string }) {
  await (await auth.$context).internalAdapter.deleteSession(device.token);
}
