import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import * as authSchema from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { parseDisplayName } from "@/domain/display-name";
import { GROUP_COOKIE, groupCookieAttributes } from "@/domain/group";
import { passkeySignup, signupTicketUses } from "./passkey-signup";
import { trackTransactions } from "./signup-transaction";

export type AuthConfig<Plugins extends BetterAuthPlugin[] = []> = {
  db: Database;
  secret: string;
  baseURL: string;
  /** Extra plugins, appended last (server/container.ts adds nextCookies()). */
  plugins?: Plugins;
};

const DAY_SECONDS = 24 * 60 * 60;

// Sign-in is passkey only: these core endpoints (email/password, email
// change and verification, social accounts, profile and session edits, user
// deletion, passkey and session management: « MON COMPTE » does it with its
// own Server Actions) are unused, so those exact paths answer 404 (/reset-password/:token,
// /callback/:id, /ok and /error still answer; harmless, see piece 6).
export const DISABLED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/social",
  "/verify-password",
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/change-email",
  "/send-verification-email",
  "/verify-email",
  "/update-user",
  "/update-session",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/delete-user",
  "/delete-user/callback",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
  "/passkey/list-user-passkeys",
  "/passkey/update-passkey",
  "/passkey/delete-passkey",
];

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
 * A passkey signup always opens its session: the plugin only wraps the user,
 * passkey and session writes in one transaction when `createSession` is set,
 * so the server forces it rather than trusting the client.
 */
const alwaysCreateSession = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/passkey/verify-registration") {
    return;
  }
  return { context: { body: { ...ctx.body, createSession: true } } };
});

/**
 * Signing out also forgets the displayed group: another account signing in
 * on this device must not open on it.
 */
const forgetGroupOnSignOut = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-out") {
    return;
  }
  ctx.setCookie(GROUP_COOKIE, "", {
    ...groupCookieAttributes(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });
});

export function createAuth<Plugins extends BetterAuthPlugin[] = []>({
  db,
  secret,
  baseURL,
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
    disabledPaths: DISABLED_PATHS,
    hooks: { before: alwaysCreateSession, after: forgetGroupOnSignOut },
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
      passkey({
        rpID: url.hostname,
        rpName: "WeWatch",
        origin: url.origin,
        registration: passkeySignup(secret),
      }),
      signupTicketUses,
      ...(plugins ?? []),
    ],
  });
}
