import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import * as authSchema from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import type { RateLimits } from "@/db/rate-limit";
import { parseDisplayName } from "@/domain/display-name";
import { GROUP_COOKIE, groupCookieAttributes } from "@/domain/group";
import { onlyAuthPaths } from "./auth-paths";
import { passkeyRegistration } from "./passkey-registration";
import { passkeySignup, signupTicketUses } from "./passkey-signup";
import { authRateLimit } from "./rate-limits";
import { trackTransactions } from "./signup-transaction";

export type AuthConfig<Plugins extends BetterAuthPlugin[] = []> = {
  db: Database;
  secret: string;
  baseURL: string;
  /** Where attempts are counted (rate-limits.ts). */
  rateLimits: RateLimits;
  /** Extra plugins, appended last (server/container.ts adds nextCookies()). */
  plugins?: Plugins;
};

const DAY_SECONDS = 24 * 60 * 60;

/**
 * How pages and Server Actions read the session (server/session.ts): from
 * the database, never from the 5-minute signed cache, so a revoked session
 * is refused at once; and without refreshing anything, because Next
 * re-renders the whole page after a Server Action that sets a cookie. The
 * proxy, which reads with the cache, keeps sessions and caches fresh.
 */
export const AUTHORITATIVE_SESSION_READ = {
  disableCookieCache: true,
  disableRefresh: true,
} as const;

/** Every name written to the user table goes through parseDisplayName. */
function normalisedName(name: unknown): { name: string } {
  const parsed = parseDisplayName(name);
  if (parsed === null) {
    throw new APIError("BAD_REQUEST", { message: "Invalid display name" });
  }
  return { name: parsed };
}

/**
 * Signing out also forgets the displayed group: another account signing in
 * on this device must not open on it.
 */
const forgetGroupOnSignOut = (baseURL: string) =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-out") {
      return;
    }
    ctx.setCookie(GROUP_COOKIE, "", {
      ...groupCookieAttributes(baseURL),
      maxAge: 0,
    });
  });

/**
 * Better Auth skips its origin and CSRF checks when it believes it runs
 * tests (NODE_ENV=test or any truthy TEST variable). In production they stay
 * on whatever the environment says; elsewhere its default is kept, so unit
 * and functional tests need no Origin header.
 */
const originCheckForcedOn = () =>
  process.env.NODE_ENV === "production"
    ? { disableOriginCheck: false, disableCSRFCheck: false }
    : {};

export function createAuth<Plugins extends BetterAuthPlugin[] = []>({
  db,
  secret,
  baseURL,
  rateLimits,
  plugins,
}: AuthConfig<Plugins>) {
  const url = new URL(baseURL);
  return betterAuth({
    appName: "WeWatch",
    secret,
    baseURL,
    // A real transaction: a passkey signup creates the user, its passkey,
    // its session and its group memberships together, or nothing at all.
    database: drizzleAdapter(trackTransactions(db), {
      provider: "sqlite",
      schema: authSchema,
      transaction: true,
    }),
    session: {
      expiresIn: 60 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      // Only the proxy trusts this signed cookie (a deleted session passes
      // it for up to 5 minutes): pages and Server Actions read the session
      // with disableCookieCache (server/session.ts). See CLAUDE.md « Pièges ».
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    emailAndPassword: { enabled: false },
    rateLimit: authRateLimit(rateLimits),
    advanced: originCheckForcedOn(),
    hooks: { after: forgetGroupOnSignOut(baseURL) },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: normalisedName(user.name) }),
        },
        update: {
          before: async (user) =>
            user.name !== undefined
              ? { data: normalisedName(user.name) }
              : undefined,
        },
      },
    },
    plugins: [
      // First: an unused path stops here, before any other plugin.
      onlyAuthPaths,
      passkey({
        rpID: url.hostname,
        rpName: "WeWatch",
        origin: url.origin,
        registration: passkeySignup(secret),
      }),
      passkeyRegistration,
      signupTicketUses,
      ...(plugins ?? []),
    ],
  });
}
