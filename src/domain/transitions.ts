import type { MovieStatus } from "./movie";

/** Did a change reach the database, or was it a no-op (see nextStatus)? */
export type ApplyResult = "applied" | "noop";

/** « ON LE VEUT » / « BOF ». */
export type SwipeDecision = "keep" | "reject";

export type MovieAction =
  | "swipe_keep"
  | "swipe_reject"
  | "search_add"
  | "remove"
  | "mark_watched"
  | "unwatch";

/**
 * Target status, or null if the action is a no-op.
 * current = null means the movie is not in the database yet.
 * The first swipe decision wins; searching for a rejected movie reverses it.
 */
export function nextStatus(
  current: MovieStatus | null,
  action: MovieAction,
): MovieStatus | null {
  switch (action) {
    case "swipe_keep":
      return current === null ? "to_watch" : null;
    case "swipe_reject":
      return current === null ? "rejected" : null;
    case "search_add":
      return current === null || current === "rejected" ? "to_watch" : null;
    case "remove":
      return current === "to_watch" ? "rejected" : null;
    case "mark_watched":
      return current === "to_watch" ? "watched" : null;
    case "unwatch":
      return current === "watched" ? "to_watch" : null;
    default: {
      const unhandled: never = action;
      throw new Error(`Unhandled movie action: ${String(unhandled)}`);
    }
  }
}

/**
 * What a swipe decision does: its action, and the status it gives a movie
 * never decided before (the only movies a swipe applies to).
 */
export const SWIPES = {
  keep: { action: "swipe_keep", status: "to_watch" },
  reject: { action: "swipe_reject", status: "rejected" },
} as const satisfies Record<
  SwipeDecision,
  { action: MovieAction; status: MovieStatus }
>;

export function isSwipeDecision(value: unknown): value is SwipeDecision {
  return value === "keep" || value === "reject";
}
