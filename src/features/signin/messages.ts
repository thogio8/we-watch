/** Error texts of the sign-in screen (spec §9). Raw error text is never shown. */
export const NAME_ERROR = "UN PRÉNOM DE 1 À 30 CARACTÈRES";
export const CLOSED_ERROR = "WEWATCH SE REJOINT SUR INVITATION";
export const WRONG_CODE_ERROR = "MAUVAIS CODE";
export const CANCELLED_ERROR = "FACE ID ANNULÉ, RÉESSAIE";
export const NO_ACCOUNT_ERROR = "AUCUN COMPTE SUR CET APPAREIL";

/** The `error` of a Better Auth client call: only its code is ever read. */
type AuthError = { code?: string; status?: number } | null | undefined;

/**
 * A failed Face ID sign-in. The server only answers PASSKEY_NOT_FOUND when
 * the device offered a passkey it does not know (account gone); everything
 * else (closed sheet, no passkey picked, network) reads as a cancellation.
 */
export function signinFailure(error: AuthError): string {
  return error?.code === "PASSKEY_NOT_FOUND"
    ? NO_ACCOUNT_ERROR
    : CANCELLED_ERROR;
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
