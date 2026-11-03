import { constantTimeEqual } from "./token";

export type SignupRight =
  { ok: true } | { ok: false; reason: "closed" | "wrong_code" };

type SignupInput = {
  mode: "open" | "invite";
  /** The person came through a valid invite link. */
  invited?: boolean;
  ownerCode?: string;
  submittedCode?: string;
};

/** The owner code a person typed, trimmed; null when blank (no code at all). */
export function submittedOwnerCode(submittedCode?: string): string | null {
  const submitted = submittedCode?.trim() ?? "";
  return submitted === "" ? null : submitted;
}

/**
 * Decides who may create an account. A valid owner code allows signup, in
 * either mode, invited or not (it bootstraps a fresh "invite" instance); it
 * grants nothing else. Without a code, signup is allowed through an
 * invitation (in either mode) or in "open" mode. A refusal says why:
 * "wrong_code" whenever a non-blank code was typed (in either mode, invited
 * or not), "closed" when none was and signup is not open. The UI message
 * derives from it.
 */
export function signupRight({
  mode,
  invited = false,
  ownerCode,
  submittedCode,
}: SignupInput): SignupRight {
  const submitted = submittedOwnerCode(submittedCode);
  if (submitted === null) {
    return invited || mode === "open"
      ? { ok: true }
      : { ok: false, reason: "closed" };
  }
  if (ownerCode !== undefined && constantTimeEqual(submitted, ownerCode)) {
    return { ok: true };
  }
  return { ok: false, reason: "wrong_code" };
}

/** What the sign-in screens offer: the signup mode, and the owner code link. */
export type SignupOffer = { signup: "open" | "invite"; ownerCode: boolean };

/**
 * Read from the environment on each request. The owner code link shows only
 * when a code is set: without one, every code would be refused. The code
 * itself never leaves the server.
 */
export function signupOffer(env: {
  SIGNUP: "open" | "invite";
  OWNER_CODE?: string;
}): SignupOffer {
  return { signup: env.SIGNUP, ownerCode: env.OWNER_CODE !== undefined };
}
