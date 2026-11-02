import type { SignupRight } from "@/access/signup";
import { isTooManyAttempts, TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import { quoted } from "@/ui/quoted";

/** Error texts of the sign-in screen (spec §9). Raw error text is never shown. */
export const NAME_ERROR = "UN PRÉNOM DE 1 À 30 CARACTÈRES";
export const CLOSED_ERROR = "WEWATCH SE REJOINT SUR INVITATION";
export const WRONG_CODE_ERROR = "MAUVAIS CODE";
export const CANCELLED_ERROR = "VALIDATION ANNULÉE, RÉESSAIE";
export const NO_ACCOUNT_ERROR = "AUCUN COMPTE SUR CET APPAREIL";

/**
 * A failed passkey sign-in. The server only answers PASSKEY_NOT_FOUND when
 * the device offered a passkey it does not know (account gone), and 429 when
 * an attempt limit refuses it; everything else (closed sheet, no passkey
 * picked, network) reads as a cancellation.
 */
export function signinFailure(error: object | null | undefined): string {
  // Only the status and code of a Better Auth client error are ever read.
  if (isTooManyAttempts(error)) {
    return TOO_MANY_ATTEMPTS;
  }
  return error && "code" in error && error.code === "PASSKEY_NOT_FOUND"
    ? NO_ACCOUNT_ERROR
    : CANCELLED_ERROR;
}

/** The message of a refused signup: a typed code was wrong, or signup is closed. */
export function refusalMessage(
  reason: Extract<SignupRight, { ok: false }>["reason"],
): string {
  return reason === "wrong_code" ? WRONG_CODE_ERROR : CLOSED_ERROR;
}

/** Which form field an error is about, so it can be flagged and focused. */
export function errorField(error: string | null): "name" | "ownerCode" | null {
  if (error === NAME_ERROR) {
    return "name";
  }
  return error === WRONG_CODE_ERROR || error === CLOSED_ERROR
    ? "ownerCode"
    : null;
}

/** The ticket's title on an invite link: « TU ES INVITÉ·E DANS « NOM » ». */
export function invitedTitle(groupName: string): string[] {
  return ["TU ES INVITÉ·E", `DANS ${quoted(groupName)}`];
}
