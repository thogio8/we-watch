"use server";

import { signupRight, submittedOwnerCode } from "@/access/signup";
import { createSignupTicket } from "@/access/signup-ticket";
import { parseDisplayName } from "@/domain/display-name";
import { TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import { getServerEnv } from "@/env";
import { INVITE_INVALID } from "@/features/groups/messages";
import { findInvitedGroup } from "@/server/invitations";
import { clientIp, withinLimit } from "@/server/rate-limit";
import { NAME_ERROR, refusalMessage, WRONG_CODE_ERROR } from "./messages";

export type PrepareSignupResult =
  { ok: true; ticket: string } | { ok: false; error: string };

/** Fixed pause before answering a wrong owner code: slows guessing, needs no storage. */
const WRONG_CODE_DELAY_MS = 500;

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * The group of the invite link the form came from: none when the field is
 * absent or empty, refused when it is anything but a known token. A malformed
 * token never reaches the database; the token itself is never kept.
 */
async function invitedGroup(
  value: FormDataEntryValue | null,
): Promise<{ ok: true; invite: string | null } | { ok: false }> {
  if (value === null || value === "") {
    return { ok: true, invite: null };
  }
  const found = await findInvitedGroup(value);
  return found === null ? { ok: false } : { ok: true, invite: found.id };
}

/**
 * « CRÉER MON COMPTE », first step: checks the name, the invite link if any
 * and the right to sign up, then hands out a short-lived signed ticket that the passkey ceremony
 * carries to Better Auth. Every attempt counts against this IP's signup
 * limit first; a typed owner code also counts against its own, just
 * before it is compared (even the right code is refused past it).
 *
 * Public on purpose, unlike every other action: it runs before the account
 * exists, so there is no session to assert. It trusts nothing instead: the
 * body may not be a form and fields may be missing or files; it only ever
 * returns a ticket or a fixed message, never the owner code.
 */
export async function prepareSignup(
  formData: FormData,
): Promise<PrepareSignupResult> {
  const ip = await clientIp();
  if (!(await withinLimit("signup", ip))) {
    return { ok: false, error: TOO_MANY_ATTEMPTS };
  }
  const fields = formData instanceof FormData ? formData : new FormData();
  const name = parseDisplayName(fields.get("name"));
  if (name === null) {
    return { ok: false, error: NAME_ERROR };
  }
  const invited = await invitedGroup(fields.get("invite"));
  if (!invited.ok) {
    return { ok: false, error: INVITE_INVALID };
  }
  const env = getServerEnv();
  const submittedCode = field(fields, "ownerCode");
  if (
    submittedOwnerCode(submittedCode) !== null &&
    !(await withinLimit("owner-code", ip))
  ) {
    return { ok: false, error: TOO_MANY_ATTEMPTS };
  }
  const right = signupRight({
    mode: env.SIGNUP,
    invited: invited.invite !== null,
    ownerCode: env.OWNER_CODE,
    submittedCode,
  });
  if (right.ok) {
    const ticket = await createSignupTicket(
      { name, invite: invited.invite },
      env.BETTER_AUTH_SECRET,
    );
    return { ok: true, ticket };
  }
  const error = refusalMessage(right.reason);
  if (error === WRONG_CODE_ERROR) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
  }
  return { ok: false, error };
}
