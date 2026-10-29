import { describe, expect, it } from "vitest";
import type { MovieStatus } from "./movie";
import { isSwipeDecision, type MovieAction, nextStatus } from "./transitions";

type Current = MovieStatus | null;

const table: [Current, MovieAction, MovieStatus | null][] = [
  [null, "swipe_keep", "to_watch"],
  [null, "search_add", "to_watch"],
  [null, "remove", null],
  [null, "mark_watched", null],
  [null, "unwatch", null],
  ["to_watch", "swipe_keep", null],
  ["to_watch", "search_add", null],
  ["to_watch", "remove", "rejected"],
  ["to_watch", "mark_watched", "watched"],
  ["to_watch", "unwatch", null],
  ["watched", "swipe_keep", null],
  ["watched", "search_add", null],
  ["watched", "remove", null],
  ["watched", "mark_watched", null],
  ["watched", "unwatch", "to_watch"],
  ["rejected", "swipe_keep", null],
  ["rejected", "search_add", "to_watch"],
  ["rejected", "remove", null],
  ["rejected", "mark_watched", null],
  ["rejected", "unwatch", null],
];

describe("nextStatus", () => {
  it.each(table)("%s × %s → %s", (current, action, expected) => {
    expect(nextStatus(current, action)).toBe(expected);
  });

  it("action inconnue (hors typage) → erreur", () => {
    expect(() =>
      nextStatus("to_watch", "bogus" as unknown as MovieAction),
    ).toThrow("Unhandled movie action");
  });
});

describe("isSwipeDecision", () => {
  it("reconnaît les décisions de swipe, refuse le reste", () => {
    expect(isSwipeDecision("keep")).toBe(true);
    expect(isSwipeDecision("reject")).toBe(true);
    expect(isSwipeDecision("watched")).toBe(false);
    expect(isSwipeDecision(undefined)).toBe(false);
  });
});
