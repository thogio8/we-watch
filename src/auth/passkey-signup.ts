import type { PasskeyOptions } from "@better-auth/passkey";
import { getCurrentAdapter, type BetterAuthPlugin } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import {
  readSignupTicket,
  type IssuedSignupTicket,
} from "@/access/signup-ticket";
import { joinLegacyGroup } from "./legacy-group-join";

type Registration = NonNullable<PasskeyOptions["registration"]>;
type ResolveUser = NonNullable<Registration["resolveUser"]>;
type AfterVerification = NonNullable<Registration["afterVerification"]>;
type EndpointContext = Parameters<AfterVerification>[0]["ctx"];

const USED_TICKETS = "signupTicketUse";

/**
 * Declares the used-ticket table (src/db/auth-schema.ts) to Better Auth, so
 * its adapter, and the transaction it runs the signup in, can write it.
 */
export const signupTicketUses = {
  id: "signup-ticket-uses",
  schema: {
    [USED_TICKETS]: { fields: { usedAt: { type: "date", required: true } } },
  },
} satisfies BetterAuthPlugin;

async function requireTicket(
  context: string | null | undefined,
  secret: string,
): Promise<IssuedSignupTicket> {
  const ticket = await readSignupTicket(context, secret);
  if (ticket === null) {
    throw new APIError("BAD_REQUEST", {
      message: "Invalid or expired signup ticket",
    });
  }
  return ticket;
}

/**
 * Marks the ticket used, through the adapter of the transaction the passkey
 * plugin wraps the signup in: a signup that fails later (passkey already
 * registered…) rolls the mark back with the user, and the ticket stays
 * usable. The primary key on the jti settles two concurrent uses: the second
 * insert fails, and so does that signup.
 */
async function consumeTicket(ctx: EndpointContext, jti: string) {
  const adapter = await getCurrentAdapter(ctx.context.adapter);
  const where = [{ field: "id", value: jti }];
  if (await adapter.findOne({ model: USED_TICKETS, where })) {
    throw new APIError("BAD_REQUEST", {
      message: "Signup ticket already used",
    });
  }
  await adapter.create({
    model: USED_TICKETS,
    data: { id: jti, usedAt: new Date() },
    forceAllowId: true,
  });
}

/**
 * Passkey-first signup: the passkey ceremony carries the signed signup ticket
 * as its `context`. The ticket is checked when the options are generated and
 * again after the WebAuthn response is verified; only then is it consumed and
 * the user created, so a cancelled ceremony leaves no orphan account and a
 * ticket opens one account at most.
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
      const { name, owner, jti } = await requireTicket(context, secret);
      await consumeTicket(ctx, jti);
      // Better Auth requires a unique email; `.invalid` is a reserved TLD.
      const user = await ctx.context.internalAdapter.createUser(
        {
          name,
          email: `${crypto.randomUUID()}@passkey.invalid`,
          emailVerified: false,
        },
        { method: "passkey" },
      );
      if (owner) {
        await joinLegacyGroup(ctx.context.adapter, user.id);
      }
      return { userId: user.id };
    },
  };
}
