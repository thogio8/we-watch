/** Shown when an attempt limit refuses a sign-in, a signup or an action. */
export const TOO_MANY_ATTEMPTS = "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.";

/** A Better Auth client error refused by an attempt limit (HTTP 429). */
export function isTooManyAttempts(error: object | null | undefined): boolean {
  return Boolean(error && "status" in error && error.status === 429);
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * Attempt limits of the Server Actions: at most `max` attempts per fixed
 * window of `window` seconds, counted under `<name>:<subject>` (an IP for
 * the public signup, else the user) before any validation. No bucket
 * shared by every IP: an attack must not lock the owner code out.
 */
export const ACTION_LIMITS = {
  signup: { window: 10 * MINUTE, max: 10 },
  "owner-code": { window: 15 * MINUTE, max: 5 },
  "create-group": { window: HOUR, max: 10 },
  "join-group": { window: HOUR, max: 20 },
  "rename-me": { window: HOUR, max: 20 },
  "delete-passkey": { window: HOUR, max: 10 },
  "delete-account": { window: HOUR, max: 5 },
} as const satisfies Record<string, { window: number; max: number }>;

export type ActionLimit = keyof typeof ACTION_LIMITS;
