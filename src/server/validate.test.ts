import { describe, expect, it } from "vitest";
import { assertSwipeDecision, assertTmdbId, isPositiveInt } from "./validate";

describe("validate", () => {
  it("isPositiveInt : entiers sûrs strictement positifs seulement", () => {
    expect(isPositiveInt(1)).toBe(true);
    for (const value of [0, -1, 1.5, Number.NaN, 2 ** 53, "3", null]) {
      expect(isPositiveInt(value)).toBe(false);
    }
  });

  it("assertTmdbId nomme l'action fautive", () => {
    expect(() => assertTmdbId("markWatched", 129)).not.toThrow();
    expect(() => assertTmdbId("markWatched", 0)).toThrow(
      "markWatched: invalid tmdbId 0",
    );
  });

  it("assertSwipeDecision n'accepte que keep et reject", () => {
    expect(() => assertSwipeDecision("decideSwipe", "keep")).not.toThrow();
    expect(() => assertSwipeDecision("decideSwipe", "KEEP")).toThrow(
      "decideSwipe: invalid decision KEEP",
    );
  });
});
