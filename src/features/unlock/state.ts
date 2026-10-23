/** Kept out of actions.ts: a "use server" file may only export async functions. */
export type UnlockState = { error: string | null };

export const INITIAL_UNLOCK_STATE: UnlockState = { error: null };

export const WRONG_CODE_MESSAGE = "MAUVAIS CODE";

/** Fixed pause before answering a wrong code: slows guessing, needs no storage. */
export const WRONG_CODE_DELAY_MS = 500;
