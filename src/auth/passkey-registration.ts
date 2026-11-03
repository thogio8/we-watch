import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getSessionFromCtx,
} from "better-auth/api";
import { deviceLabel } from "@/domain/device";
import { isRecentSignIn, STALE_SESSION_CODE } from "@/domain/recent-sign-in";

const OPTIONS_PATH = "/passkey/generate-register-options";
const VERIFY_PATH = "/passkey/verify-registration";

type CreationOptions = { user: { name: string; displayName: string } };

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * The request's headers without Better Auth's session cookies (token, cache,
 * and their chunks `name.0`…): the plugin then reads no session, as it
 * should for one the database no longer has. Its own cookies (the WebAuthn
 * challenge) are kept.
 */
function withoutSessionCookies(ctx: HookContext): Headers {
  const names = Object.values(ctx.context.authCookies).map(({ name }) => name);
  const isSession = (cookie: string) => {
    const name = cookie.trim().split("=")[0] as string;
    return names.some((n) => name === n || name.startsWith(`${n}.`));
  };
  const kept = (ctx.headers?.get("cookie") ?? "")
    .split(";")
    .filter((cookie) => !isSession(cookie));
  return new Headers({ cookie: kept.join(";").trim() });
}

/**
 * Signed in, read from the database. The plugin itself trusts the 5-minute
 * signed cache: for a session revoked elsewhere, the request then goes on
 * without its session cookies, so a signup ticket opens a new account
 * normally instead of being tied to the revoked one.
 */
async function authoritativeSignIn(ctx: HookContext) {
  const session = await getAuthoritativeSessionFromCtx(ctx);
  const signedIn = session !== null;
  return {
    session,
    signedIn,
    request: signedIn ? {} : { headers: withoutSessionCookies(ctx) },
  };
}

/**
 * Register options are made for the session the database vouches for, and
 * only a recent one adds a passkey: the plugin's own freshness check is off
 * with `requireSession: false` (passkeySignup), and a phone left unlocked
 * must not let anyone add theirs. The client recognises the refusal
 * (isStaleSession), asks the device lock again, then retries. A signup has
 * no session and is not concerned.
 */
const recentSessionOptions = createAuthMiddleware(async (ctx) => {
  const { session, request } = await authoritativeSignIn(ctx);
  if (
    session !== null &&
    !isRecentSignIn(new Date(session.session.createdAt), new Date())
  ) {
    throw new APIError("FORBIDDEN", {
      message: "Session is not fresh",
      code: STALE_SESSION_CODE,
    });
  }
  return { context: request };
});

const isCreationOptions = (value: unknown): value is CreationOptions =>
  typeof value === "object" &&
  value !== null &&
  "user" in value &&
  typeof value.user === "object";

/**
 * The server, never the client, decides how a passkey registration ends:
 * - its name is the device it is made on (« iPhone · Safari »);
 * - a signup opens its session (the plugin only wraps the user, passkey and
 *   session writes in one transaction when `createSession` is set), while a
 *   passkey added when signed in opens none. Signed in is read from the
 *   database, so a session revoked elsewhere counts as signed out (and its
 *   registration then needs a signup ticket: see passkeySignup).
 */
const serverDecidedRegistration = createAuthMiddleware(async (ctx) => {
  const { signedIn, request } = await authoritativeSignIn(ctx);
  return {
    context: {
      ...request,
      body: {
        ...ctx.body,
        name: deviceLabel(ctx.headers?.get("user-agent")),
        createSession: !signedIn,
      },
    },
  };
});

/**
 * The account name the device stores with the passkey (its keychain) is the
 * display name: the plugin would use the session's email, a meaningless
 * `@passkey.invalid` address, or a name the client sent. Signed out (a
 * signup), it is the ticket's name the options already carry as displayName.
 * Only a label: reads the session as the plugin did to build these options.
 */
const displayNameInKeychain = createAuthMiddleware(async (ctx) => {
  const options: unknown = ctx.context.returned;
  if (!isCreationOptions(options)) {
    return;
  }
  const session = await getSessionFromCtx(ctx);
  const name = session?.user.name ?? options.user.displayName;
  return ctx.json({
    ...options,
    user: { ...options.user, name, displayName: name },
  });
});

export const passkeyRegistration = {
  id: "passkey-registration",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === OPTIONS_PATH,
        handler: recentSessionOptions,
      },
      {
        matcher: (ctx) => ctx.path === VERIFY_PATH,
        handler: serverDecidedRegistration,
      },
    ],
    after: [
      {
        matcher: (ctx) => ctx.path === OPTIONS_PATH,
        handler: displayNameInKeychain,
      },
    ],
  },
} satisfies BetterAuthPlugin;
