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

  it("compte les points de code et normalise en NFC", () => {
    expect(parseLabel("😀".repeat(3), 3)).toBe("😀😀😀");
    expect(parseLabel("Léa", 30)).toBe("Léa");
  });
});
