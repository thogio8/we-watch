import { describe, expect, it } from "vitest";
import { parseLabel } from "./label";

describe("parseLabel", () => {
  it("normalise puis borne la longueur donnée", () => {
    expect(parseLabel("  Soirée   ciné  ", 12)).toBe("Soirée ciné");
    expect(parseLabel("a".repeat(5), 5)).toBe("aaaaa");
    expect(parseLabel("a".repeat(6), 5)).toBeNull();
  });

  it("refuse le vide, l'invisible, les contrôles et le non-texte", () => {
    expect(parseLabel("   ", 30)).toBeNull();
    expect(parseLabel("\u200B", 30)).toBeNull();
    expect(parseLabel("Lé\u0000a", 30)).toBeNull();
    expect(parseLabel("\u202Eabc", 30)).toBeNull();
    expect(parseLabel(42, 30)).toBeNull();
  });

  it("garde un emoji composé avec un joiner et refuse un accent isolé", () => {
    expect(parseLabel("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", 30)).toBe(
      "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
    );
    expect(parseLabel("\u0301", 30)).toBeNull();
  });

  it.each([
    ["une espace sans chasse (U+200B)", "Lé\u200Ba"],
    ["un joiner de mot (U+2060)", "Lé\u2060a"],
    ["une marque d’ordre des octets (U+FEFF)", "Lé\uFEFFa"],
    ["un remplissage hangûl (U+3164)", "\u3164"],
    ["un motif braille vide (U+2800)", "\u2800"],
    ["un remplissage de choseong (U+115F)", "\u115F"],
    ["un remplissage de jungseong (U+1160)", "Lé\u1160a"],
    ["un remplissage hangûl demi-chasse (U+FFA0)", "\uFFA0"],
  ])("refuse %s, même entouré de lettres", (_label, input) => {
    expect(parseLabel(input, 30)).toBeNull();
    expect(parseLabel(`Léa ${input}`, 30)).toBeNull();
  });

  it("garde une famille liée par des joiners et un cœur avec son sélecteur de variante", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
    expect(parseLabel(family, 30)).toBe(family);
    expect(parseLabel("Léa \u2764\uFE0F", 30)).toBe("Léa \u2764\uFE0F");
  });

  it("compte les points de code et normalise en NFC", () => {
    expect(parseLabel("😀".repeat(3), 3)).toBe("😀😀😀");
    expect(parseLabel("Léa", 30)).toBe("Léa");
  });
});
