import { describe, expect, it } from "vitest";
import {
  GROUP_COOKIE,
  type GroupSummary,
  isInviteToken,
  LEGACY_GROUP_ID,
  LEGACY_GROUP_NAME,
  parseGroupName,
} from "./group";

describe("parseGroupName", () => {
  it("retire les espaces autour et réduit les internes", () => {
    expect(parseGroupName("  Ciné   du  jeudi ")).toBe("Ciné du jeudi");
  });

  it("accepte 30 caractères et refuse 31", () => {
    expect(parseGroupName("a".repeat(30))).toBe("a".repeat(30));
    expect(parseGroupName("a".repeat(31))).toBeNull();
  });

  it("compte les caractères et non les unités UTF-16", () => {
    expect(parseGroupName("😀".repeat(30))).toBe("😀".repeat(30));
    expect(parseGroupName("😀".repeat(31))).toBeNull();
  });

  it("refuse vide, invisible, contrôles, bidi et non-texte", () => {
    expect(parseGroupName("")).toBeNull();
    expect(parseGroupName("\u200B\u2060")).toBeNull();
    expect(parseGroupName("Gro\u0000upe")).toBeNull();
    expect(parseGroupName("\u202Egroupe")).toBeNull();
    expect(parseGroupName(null)).toBeNull();
    expect(parseGroupName(7)).toBeNull();
  });

  it("normalise en NFC", () => {
    expect(parseGroupName("Léa")).toBe("Léa");
  });

  it("nomme le cookie du groupe affiché", () => {
    expect(GROUP_COOKIE).toBe("ww_group");
  });

  it("le groupe hérité a un nom que le nom de groupe accepte", () => {
    const legacy: GroupSummary = {
      id: LEGACY_GROUP_ID,
      name: LEGACY_GROUP_NAME,
      memberCount: 0,
    };
    expect(LEGACY_GROUP_ID).toBe("nous-deux");
    expect(parseGroupName(legacy.name)).toBe("NOUS DEUX");
  });
});

describe("isInviteToken", () => {
  const TOKEN = "Ab0_-".repeat(8) + "xyz";

  it("accepte 43 caractères base64url", () => {
    expect(TOKEN).toHaveLength(43);
    expect(isInviteToken(TOKEN)).toBe(true);
  });

  it("refuse une autre longueur", () => {
    expect(isInviteToken(TOKEN.slice(1))).toBe(false);
    expect(isInviteToken(`${TOKEN}a`)).toBe(false);
    expect(isInviteToken("")).toBe(false);
  });

  it.each(["+", "/", "=", " ", "%", "é", "\n"])(
    "refuse le caractère %j",
    (char) => {
      expect(isInviteToken(TOKEN.slice(1) + char)).toBe(false);
    },
  );

  it("refuse ce qui n’est pas une chaîne", () => {
    expect(isInviteToken(null)).toBe(false);
    expect(isInviteToken(undefined)).toBe(false);
    expect(isInviteToken(12)).toBe(false);
    expect(isInviteToken([TOKEN])).toBe(false);
  });
});
