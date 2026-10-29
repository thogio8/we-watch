import { constantTimeEqual } from "./token";

export type SignupRight =
  { ok: true; owner: boolean } | { ok: false; reason: "closed" | "wrong_code" };

type SignupInput = {
  mode: "open" | "invite";
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
 * owner role. Without one, signup is allowed only in "open" mode; a wrong code
 * is refused in "open" mode (clear feedback) and reads as "closed" in "invite".
 */
export function signupRight({
  mode,
  ownerCode,
  submittedCode,
}: SignupInput): SignupRight {
  const submitted = submittedOwnerCode(submittedCode);
  if (submitted === null) {
    return mode === "open"
      ? { ok: true, owner: false }
      : { ok: false, reason: "closed" };
  }
  if (ownerCode !== undefined && constantTimeEqual(submitted, ownerCode)) {
    return { ok: true, owner: true };
  }
  return { ok: false, reason: mode === "open" ? "wrong_code" : "closed" };
}
