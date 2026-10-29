import { describe, expect, it } from "vitest";
import { parseDisplayName } from "./display-name";

describe("parseDisplayName", () => {
  it("retire les espaces autour du nom", () => {
    expect(parseDisplayName("  Léa  ")).toBe("Léa");
  });

  it("réduit les espaces internes à un seul", () => {
    expect(parseDisplayName("Jean   Pierre")).toBe("Jean Pierre");
    expect(parseDisplayName("Jean \t\n Pierre")).toBe("Jean Pierre");
  });

  it("refuse un nom vide ou fait d'espaces", () => {
    expect(parseDisplayName("")).toBeNull();
    expect(parseDisplayName("   ")).toBeNull();
  });

  it("accepte 30 caractères et refuse 31", () => {
    expect(parseDisplayName("a".repeat(30))).toBe("a".repeat(30));
    expect(parseDisplayName("a".repeat(31))).toBeNull();
  });

  it("compte les caractères et non les unités UTF-16", () => {
    expect(parseDisplayName("😀".repeat(30))).toBe("😀".repeat(30));
    expect(parseDisplayName("😀".repeat(31))).toBeNull();
  });

  it("compte la longueur après normalisation", () => {
    expect(parseDisplayName(`  ${"a".repeat(30)}  `)).toBe("a".repeat(30));
    expect(parseDisplayName(`${"a".repeat(15)}      ${"b".repeat(14)}`)).toBe(
      `${"a".repeat(15)} ${"b".repeat(14)}`,
    );
  });

  it("garde les emoji composés avec un joiner", () => {
    expect(parseDisplayName("👨‍👩‍👧")).toBe("👨‍👩‍👧");
  });

  it("refuse un nom sans caractère visible", () => {
    expect(parseDisplayName("\u200B\u2060")).toBeNull();
    expect(parseDisplayName("\u0301")).toBeNull();
  });

  it("refuse les caractères de contrôle", () => {
    expect(parseDisplayName("Lé\u0000a")).toBeNull();
    expect(parseDisplayName("Léa\u0007")).toBeNull();
    expect(parseDisplayName("Léa\u007F")).toBeNull();
  });

  it("refuse les contrôles de sens d'écriture", () => {
    expect(parseDisplayName("\u202Eaéл")).toBeNull();
    expect(parseDisplayName("Léa\u2066")).toBeNull();
    expect(parseDisplayName("Léa\u200F")).toBeNull();
  });

  it("normalise en NFC", () => {
    expect(parseDisplayName("Le\u0301a")).toBe("Léa");
  });

  it("refuse ce qui n'est pas du texte", () => {
    expect(parseDisplayName(42)).toBeNull();
    expect(parseDisplayName(null)).toBeNull();
    expect(parseDisplayName(undefined)).toBeNull();
    expect(parseDisplayName(new File([""], "x.txt"))).toBeNull();
  });
});
