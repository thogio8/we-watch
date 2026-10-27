import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/domain/tonight";
import { parseStoredTonight, serializeTonight } from "./tonightStorage";

describe("tonightStorage", () => {
  it("aller-retour sans l'humeur", () => {
    const raw = serializeTonight({
      bedtime: 1410,
      moods: ["laugh"],
      platforms: ["netflix", "prime"],
    });
    expect(JSON.parse(raw)).toEqual({
      bedtime: 1410,
      platforms: ["netflix", "prime"],
    });
    expect(parseStoredTonight(raw)).toEqual({
      bedtime: 1410,
      platforms: ["netflix", "prime"],
    });
  });

  it.each([null, "", "{", "null", "42", '"x"'])(
    "valeur absente ou illisible (%s) → rien",
    (raw) => {
      expect(parseStoredTonight(raw)).toEqual({
        bedtime: NO_FILTERS.bedtime,
        platforms: [],
      });
    },
  );

  it("ignore une heure hors liste et les plateformes invalides", () => {
    expect(
      parseStoredTonight(
        JSON.stringify({ bedtime: 1234, platforms: ["netflix", 9, null] }),
      ),
    ).toEqual({ bedtime: null, platforms: ["netflix"] });
    expect(
      parseStoredTonight(JSON.stringify({ bedtime: "1410", platforms: "x" })),
    ).toEqual({ bedtime: null, platforms: [] });
  });
});
