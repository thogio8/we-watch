import { constantTimeEqual } from "./token";

export type SignupRight =
  { ok: true; owner: boolean } | { ok: false; reason: "closed" | "wrong_code" };

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
 * Decides who may create an account. A valid owner code always grants the
 * owner role, invited or not. Without a code, signup is allowed through an
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
      ? { ok: true, owner: false }
      : { ok: false, reason: "closed" };
  }
  if (ownerCode !== undefined && constantTimeEqual(submitted, ownerCode)) {
    return { ok: true, owner: true };
  }
  return { ok: false, reason: "wrong_code" };
}
