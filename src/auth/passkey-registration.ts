import type { BetterAuthPlugin } from "better-auth";
import {
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getSessionFromCtx,
} from "better-auth/api";
import { deviceLabel } from "@/domain/device";

const OPTIONS_PATH = "/passkey/generate-register-options";
const VERIFY_PATH = "/passkey/verify-registration";

type CreationOptions = { user: { name: string; displayName: string } };

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
  const signedIn = (await getAuthoritativeSessionFromCtx(ctx)) !== null;
  return {
    context: {
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
