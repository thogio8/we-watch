import { describe, expect, it } from "vitest";
import {
  computeEndTime,
  formatClock,
  formatRuntime,
  formatShortDate,
} from "./time";

const at = (h: number, m: number) => new Date(2026, 9, 23, h, m);

describe("time", () => {
  it("ajoute la durée", () =>
    expect(formatClock(computeEndTime(at(21, 7), 125)!)).toBe("23H12"));
  it("passe minuit", () =>
    expect(formatClock(computeEndTime(at(23, 30), 125)!)).toBe("01H35"));
  it("durée inconnue → null", () => {
    expect(computeEndTime(at(21, 0), null)).toBeNull();
    expect(computeEndTime(at(21, 0), 0)).toBeNull();
  });
  it("formatClock pad à 2 chiffres", () =>
    expect(formatClock(at(9, 5))).toBe("09H05"));
  it("formatRuntime", () => {
    expect(formatRuntime(125)).toBe("2h05");
    expect(formatRuntime(47)).toBe("0h47");
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
  it("formatShortDate JJ/MM", () =>
    expect(formatShortDate(new Date(2026, 9, 4))).toBe("04/10"));
});
