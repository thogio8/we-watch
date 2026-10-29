import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import * as authSchema from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";
import { parseDisplayName } from "@/domain/display-name";
import { generateId, groupModels } from "./legacy-group-join";
import { passkeySignup, signupTicketUses } from "./passkey-signup";

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
// deletion, passkey management) are unused, so those exact paths answer 404 (/reset-password/:token,
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
    // A real transaction: a passkey signup creates the user, its passkey and
    // its session together, or nothing at all.
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { ...authSchema, group, membership },
      transaction: true,
    }),
    session: {
      expiresIn: 60 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      // Known lag: while this signed cookie is valid, a deleted session is
      // still accepted (up to 5 minutes). Piece 5 reads sensitive data with
      // disableCookieCache. See CLAUDE.md « Pièges ».
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: { database: { generateId } },
    emailAndPassword: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    hooks: { before: alwaysCreateSession },
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
      groupModels,
      ...(plugins ?? []),
    ],
  });
}
