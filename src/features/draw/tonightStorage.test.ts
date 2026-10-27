import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/domain/tonight";
import { parseStoredTonight, serializeTonight } from "./tonightStorage";

describe("tonightStorage", () => {
  it("aller-retour sans l'humeur", () => {
    const raw = serializeTonight({
      bedtime: 1410,
      moods: ["laugh"],
      providerIds: [8, 119],
    });
    expect(JSON.parse(raw)).toEqual({ bedtime: 1410, providerIds: [8, 119] });
    expect(parseStoredTonight(raw)).toEqual({
      bedtime: 1410,
      providerIds: [8, 119],
    });
  });

  it.each([null, "", "{", "null", "42", '"x"'])(
    "valeur absente ou illisible (%s) → rien",
    (raw) => {
      expect(parseStoredTonight(raw)).toEqual({
        bedtime: NO_FILTERS.bedtime,
        providerIds: [],
      });
    },
  );

  it("ignore une heure hors liste et les ids invalides", () => {
    expect(
      parseStoredTonight(
        JSON.stringify({ bedtime: 1234, providerIds: [8, "9", 1.5, null] }),
      ),
    ).toEqual({ bedtime: null, providerIds: [8] });
    expect(
      parseStoredTonight(JSON.stringify({ bedtime: "1410", providerIds: 8 })),
    ).toEqual({ bedtime: null, providerIds: [] });
  });
});
