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

/** Where each action takes a movie; "new" = not in the database yet. */
const TRANSITIONS: Record<
  MovieAction,
  Partial<Record<MovieStatus | "new", MovieStatus>>
> = {
  swipe_keep: { new: "to_watch" },
  swipe_reject: { new: "rejected" },
  search_add: { new: "to_watch", rejected: "to_watch" },
  remove: { to_watch: "rejected" },
  mark_watched: { to_watch: "watched" },
  unwatch: { watched: "to_watch" },
};

/**
 * Target status, or null if the action is a no-op.
 * current = null means the movie is not in the database yet.
 * The first swipe decision wins; searching for a rejected movie reverses it.
 */
export function nextStatus(
  current: MovieStatus | null,
  action: MovieAction,
): MovieStatus | null {
  const targets = TRANSITIONS[action] as
    (typeof TRANSITIONS)[MovieAction] | undefined;
  // Server Actions receive untyped input: an unknown action is a bug.
  if (targets === undefined) {
    throw new Error(`Unhandled movie action: ${String(action)}`);
  }
  return targets[current ?? "new"] ?? null;
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
