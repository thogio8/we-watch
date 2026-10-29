import type { PasskeyOptions } from "@better-auth/passkey";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { readSignupTicket, type SignupTicket } from "@/access/signup-ticket";

type Registration = NonNullable<PasskeyOptions["registration"]>;
type ResolveUser = NonNullable<Registration["resolveUser"]>;
type AfterVerification = NonNullable<Registration["afterVerification"]>;

async function requireTicket(
  context: string | null | undefined,
  secret: string,
): Promise<SignupTicket> {
  const ticket = await readSignupTicket(context, secret);
  if (ticket === null) {
    throw new APIError("BAD_REQUEST", {
      message: "Invalid or expired signup ticket",
    });
  }
  return ticket;
}

/**
 * Passkey-first signup: the passkey ceremony carries the signed signup ticket
 * as its `context`. The ticket is checked when the options are generated and
 * again after the WebAuthn response is verified; only then is the user
 * created, so a cancelled ceremony leaves no orphan account.
 */
export function passkeySignup(secret: string): {
  requireSession: false;
  resolveUser: ResolveUser;
  afterVerification: AfterVerification;
} {
  return {
    requireSession: false,
    // Only supplies the WebAuthn user handle and label shown by the device.
    resolveUser: async ({ context }) => {
      const { name } = await requireTicket(context, secret);
      return { id: crypto.randomUUID(), name, displayName: name };
    },
    afterVerification: async ({ ctx, context }) => {
      // Signed in, the plugin would attach the passkey to the current user
      // and refuse the new one: never create an account that cannot be used.
      if (await getSessionFromCtx(ctx)) {
        throw new APIError("BAD_REQUEST", { message: "Already signed in" });
      }
      const { name } = await requireTicket(context, secret);
      // Better Auth requires a unique email; `.invalid` is a reserved TLD.
      const user = await ctx.context.internalAdapter.createUser(
        {
          name,
          email: `${crypto.randomUUID()}@passkey.invalid`,
          emailVerified: false,
        },
        { method: "passkey" },
      );
      return { userId: user.id };
    },
  };
}
