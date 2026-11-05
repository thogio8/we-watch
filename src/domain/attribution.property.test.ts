import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_NAMES, wantedLine } from "./attribution";

// The spec says three: spelled out, so the rule cannot drift with the constant.
const THREE = 3;

const names = fc.array(fc.constantFrom("Léa", "Hugo", "Sam", "Inès"), {
  maxLength: 12,
});
const size = fc.integer({ min: 1, max: 20 });

describe("wantedLine (propriétés)", () => {
  it("MAX_NAMES vaut trois", () => expect(MAX_NAMES).toBe(THREE));

  it("ne cite jamais plus de trois prénoms", () =>
    fc.assert(
      fc.property(names, size, fc.boolean(), (list, groupSize, matched) => {
        const line = wantedLine(list, { groupSize, matched }) ?? "";
        const cited = list.filter((n) => line.includes(n));
        expect(new Set(cited).size).toBeLessThanOrEqual(THREE);
        if (/^voulu par [A-Z]/u.test(line)) {
          expect(line.split(/, | et /u).length).toBeLessThanOrEqual(THREE);
        }
      }),
    ));

  it("ne compte « K sur N » qu'au-delà de trois, avec K <= N", () =>
    fc.assert(
      fc.property(names, size, fc.boolean(), (list, groupSize, matched) => {
        const m = /^voulu par (\d+) sur (\d+)$/u.exec(
          wantedLine(list, { groupSize, matched }) ?? "",
        );
        if (m === null) return;
        expect(Number(m[1])).toBe(list.length);
        expect(Number(m[1])).toBeGreaterThan(THREE);
        expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2]));
      }),
    ));

  it("ne dit « tout le groupe » ou « vous deux » que sur un match", () =>
    fc.assert(
      fc.property(names, size, (list, groupSize) => {
        const line = wantedLine(list, { groupSize, matched: false }) ?? "";
        expect(line).not.toMatch(/tout le groupe|vous deux/u);
      }),
    ));
});
