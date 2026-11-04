import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseLabel } from "./label";

// Binary noise, plus strings made mostly of letters and blanks, which is where
// the trimming and collapsing rules live.
const text = fc.oneof(
  fc.string({ unit: "binary", maxLength: 40, size: "max" }),
  fc
    .array(fc.constantFrom("a", "é", "😀", " ", "\t", "\u00a0", "\n"), {
      maxLength: 40,
      size: "max",
    })
    .map((chars) => chars.join("")),
);
const max = fc.integer({ min: 1, max: 40 });

describe("parseLabel (propriétés)", () => {
  it("normaliser est idempotent : un libellé accepté reste accepté, inchangé", () =>
    fc.assert(
      fc.property(text, max, (input, n) => {
        const label = parseLabel(input, n);
        if (label !== null) expect(parseLabel(label, n)).toBe(label);
      }),
    ));

  it("un libellé accepté est propre : 1 à n caractères, sans espace en bordure ni double", () =>
    fc.assert(
      fc.property(text, max, (input, n) => {
        const label = parseLabel(input, n);
        if (label === null) return;
        expect([...label].length).toBeGreaterThanOrEqual(1);
        expect([...label].length).toBeLessThanOrEqual(n);
        expect(label).toBe(label.trim());
        expect(label).not.toMatch(/\s\s|[^\S ]/);
        expect(label).toBe(label.normalize("NFC"));
      }),
    ));

  it("tout ce qui n'est pas du texte est refusé", () =>
    fc.assert(
      fc.property(
        fc.anything().filter((v) => typeof v !== "string"),
        max,
        (input, n) => {
          expect(parseLabel(input, n)).toBeNull();
        },
      ),
    ));

  it("la borne est en caractères : n lettres passent, n + 1 non", () =>
    fc.assert(
      fc.property(max, fc.constantFrom("a", "é", "😀"), (n, char) => {
        expect(parseLabel(char.repeat(n), n)).toBe(char.repeat(n));
        expect(parseLabel(char.repeat(n + 1), n)).toBeNull();
      }),
    ));
});
