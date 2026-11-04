import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeEndTime, formatClock, formatRuntime } from "./time";

const start = fc.date({
  min: new Date(2020, 0, 1),
  max: new Date(2035, 0, 1),
  noInvalidDate: true,
});

describe("time (propriétés)", () => {
  it("« FINI À » est toujours postérieur au départ, d'exactement la durée", () =>
    fc.assert(
      fc.property(start, fc.integer({ min: 1, max: 600 }), (d, minutes) => {
        const end = computeEndTime(d, minutes);
        expect(end?.getTime()).toBe(d.getTime() + minutes * 60_000);
        expect(end!.getTime()).toBeGreaterThan(d.getTime());
      }),
    ));

  it("l'heure s'écrit toujours HHHMM", () =>
    fc.assert(
      fc.property(start, (d) => {
        expect(formatClock(d)).toMatch(/^([01]\d|2[0-3])H[0-5]\d$/);
      }),
    ));

  it("la durée s'écrit XhMM et se relit à l'identique", () =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (minutes) => {
        const [h = NaN, m = NaN] = formatRuntime(minutes)!
          .split("h")
          .map(Number);
        expect(h * 60 + m).toBe(minutes);
      }),
    ));
});
