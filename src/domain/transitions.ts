import type { MovieStatus } from "./movie";

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
