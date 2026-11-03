import { describe, expect, it } from "vitest";
import {
  computeEndTime,
  formatClock,
  formatRuntime,
  formatLongDate,
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
  it("formatLongDate écrit la date en toutes lettres, heure de Paris", () => {
    expect(formatLongDate(new Date("2026-10-27T12:00:00Z"))).toBe(
      "27 octobre 2026",
    );
    // 23 h 30 UTC on the 31st is already the 1st in Paris.
    expect(formatLongDate(new Date("2026-12-31T23:30:00Z"))).toBe(
      "1er janvier 2027",
    );
  });
  it("formatLongDate écrit « 1er » le premier du mois, pas les autres jours", () => {
    expect(formatLongDate(new Date("2026-10-01T12:00:00Z"))).toBe(
      "1er octobre 2026",
    );
    expect(formatLongDate(new Date("2026-10-11T12:00:00Z"))).toBe(
      "11 octobre 2026",
    );
    expect(formatLongDate(new Date("2026-10-21T12:00:00Z"))).toBe(
      "21 octobre 2026",
    );
  });
  it("formatShortDate JJ/MM", () =>
    expect(formatShortDate(new Date(2026, 9, 4))).toBe("04/10"));
});
