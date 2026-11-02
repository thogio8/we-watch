import { describe, expect, it } from "vitest";
import {
  assertId,
  assertSwipeDecision,
  assertTmdbId,
  isPositiveInt,
} from "./validate";

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

  it("assertId : une chaîne de 1 à 64 caractères, sinon nomme l'action", () => {
    expect(() => assertId("deletePasskey", "p-1")).not.toThrow();
    expect(() => assertId("deletePasskey", "x".repeat(64))).not.toThrow();
    for (const value of ["", "x".repeat(65), 42, null, undefined]) {
      expect(() => assertId("deletePasskey", value)).toThrow(
        "deletePasskey: invalid id",
      );
    }
  });
});
