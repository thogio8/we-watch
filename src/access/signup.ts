import { constantTimeEqual } from "./token";

export type SignupRight =
  { ok: true; owner: boolean } | { ok: false; reason: "closed" | "wrong_code" };

type SignupInput = {
  mode: "open" | "invite";
  ownerCode?: string;
  submittedCode?: string;
};

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
  const submitted = submittedCode?.trim() ?? "";
  if (submitted === "") {
    return mode === "open"
      ? { ok: true, owner: false }
      : { ok: false, reason: "closed" };
  }
  if (ownerCode !== undefined && constantTimeEqual(submitted, ownerCode)) {
    return { ok: true, owner: true };
  }
  return { ok: false, reason: mode === "open" ? "wrong_code" : "closed" };
}
