import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isInviteToken, parseGroupName } from "./group";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const tokenChar = fc.constantFrom(...ALPHABET);

describe("isInviteToken (propriétés)", () => {
  it("accepte tout jeton de 43 caractères base64url", () =>
    fc.assert(
      fc.property(
        fc.array(tokenChar, { minLength: 43, maxLength: 43 }),
        (c) => {
          expect(isInviteToken(c.join(""))).toBe(true);
        },
      ),
    ));

  it("refuse toute autre longueur et tout caractère hors alphabet", () =>
    fc.assert(
      fc.property(
        fc
          .array(tokenChar, { minLength: 0, maxLength: 80, size: "max" })
          .filter((c) => c.length !== 43),
        fc.integer({ min: 0, max: 42 }),
        fc.constantFrom("=", "+", "/", " ", "\n", "é"),
        (wrongLength, at, bad) => {
          expect(isInviteToken(wrongLength.join(""))).toBe(false);
          const chars = Array.from({ length: 43 }, () => "A");
          chars[at] = bad;
          expect(isInviteToken(chars.join(""))).toBe(false);
        },
      ),
    ));
});

describe("parseGroupName (propriétés)", () => {
  it("un nom accepté fait 1 à 30 caractères et reste accepté tel quel", () =>
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 40, size: "max" }),
        (input) => {
          const parsed = parseGroupName(input);
          if (parsed === null) return;
          expect([...parsed].length).toBeLessThanOrEqual(30);
          expect(parseGroupName(parsed)).toBe(parsed);
        },
      ),
    ));
});
