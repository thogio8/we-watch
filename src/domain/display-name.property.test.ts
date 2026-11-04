import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { confirmsName } from "./display-name";

const name = fc.string({ unit: "binary", maxLength: 30 });

describe("confirmsName (propriétés)", () => {
  it("un nom se confirme lui-même, entouré d'espaces ou non", () =>
    fc.assert(
      fc.property(name, fc.constantFrom("", " ", "\t", "  \n"), (n, pad) => {
        expect(confirmsName(n, n)).toBe(true);
        expect(confirmsName(`${pad}${n}${pad}`, n)).toBe(true);
      }),
    ));

  it("n'importe quelle apostrophe vaut n'importe quelle autre", () =>
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "'", "’", "‘", "ʼ", " "), {
          maxLength: 12,
        }),
        (chars) => {
          const typed = chars.join("");
          const stored = chars
            .map((c) => (c === "a" || c === " " ? c : "'"))
            .join("");
          expect(confirmsName(typed, stored)).toBe(true);
        },
      ),
    ));

  it("la comparaison est symétrique pour deux textes", () =>
    fc.assert(
      fc.property(
        name,
        fc.constantFrom("", " ", "\t"),
        fc.boolean(),
        (a, pad, swap) => {
          const b = `${pad}${swap ? a.replaceAll("'", "\u2019") : a}${pad}`;
          expect(confirmsName(a, b)).toBe(confirmsName(b, a));
        },
      ),
    ));

  it("la casse compte", () =>
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,10}$/), (n) => {
        expect(confirmsName(n.toUpperCase(), n)).toBe(false);
      }),
    ));
});
