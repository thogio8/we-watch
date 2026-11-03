import { isSwipeDecision, type SwipeDecision } from "@/domain/transitions";

/*
 * Server Actions are public endpoints: never trust their arguments' types.
 * Each check throws with the action's name, so a bad call is easy to trace.
 */

export function isPositiveInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function assertTmdbId(action: string, tmdbId: unknown): void {
  if (!isPositiveInt(tmdbId)) {
    throw new Error(`${action}: invalid tmdbId ${String(tmdbId)}`);
  }
}

export function assertSwipeDecision(
  action: string,
  decision: unknown,
): asserts decision is SwipeDecision {
  if (!isSwipeDecision(decision)) {
    throw new Error(`${action}: invalid decision ${String(decision)}`);
  }
}

/** A database id (passkey, session…): a string of 1 to 64 characters. */
export function assertId(action: string, id: unknown): asserts id is string {
  if (typeof id !== "string" || id.length < 1 || id.length > 64) {
    throw new Error(`${action}: invalid id`);
  }
}
