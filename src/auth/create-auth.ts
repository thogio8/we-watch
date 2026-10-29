import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import * as authSchema from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { parseDisplayName } from "@/domain/display-name";
import { passkeySignup } from "./passkey-signup";

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
// deletion, passkey management) are unused, so they answer 404.
const DISABLED_PATHS = [
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
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    session: {
      expiresIn: 60 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    emailAndPassword: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: normalisedName(user.name) }),
        },
        update: {
          before: async (user) =>
            "name" in user ? { data: normalisedName(user.name) } : undefined,
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
      ...(plugins ?? []),
    ],
  });
}
