import { describe, expect, it } from "vitest";
import { isFavorite, isMatch } from "./movie";

const NOV_4 = new Date("2026-11-04T10:00:00Z");

describe("isFavorite", () => {
  it("suit favoriteAt", () => {
    expect(isFavorite({ favoriteAt: NOV_4 })).toBe(true);
    expect(isFavorite({ favoriteAt: null })).toBe(false);
  });
});

describe("isMatch", () => {
  it("suit matchedAt", () => {
    expect(isMatch({ matchedAt: NOV_4 })).toBe(true);
    expect(isMatch({ matchedAt: null })).toBe(false);
  });
});
