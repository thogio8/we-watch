import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/domain/tonight";
import {
  parseStoredTonight,
  readStoredTonight,
  serializeTonight,
  tonightStorageKey,
} from "./tonightStorage";

const V1 = JSON.stringify({ bedtime: 1380, platforms: ["netflix"] });
const V2 = JSON.stringify({ bedtime: 1410, platforms: [] });

/** A device storage holding these keys. */
const storageWith = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
});

describe("tonightStorage", () => {
  it("aller-retour sans l'humeur", () => {
    const raw = serializeTonight({
      ...NO_FILTERS,
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

  it("ne garde jamais le filtre coups de cœur sur l’appareil", () => {
    expect(
      JSON.parse(serializeTonight({ ...NO_FILTERS, favoritesOnly: true })),
    ).toEqual({ bedtime: null, platforms: [] });
    expect(parseStoredTonight('{"favoritesOnly":true}')).toEqual({
      bedtime: null,
      platforms: [],
    });
  });

  it("une clé par groupe", () => {
    expect(tonightStorageKey("groupe-a")).toBe("ww-tonight-v2:groupe-a");
  });

  it("lit la soirée du groupe demandé, pas celle d'un autre", () => {
    const storage = storageWith({ "ww-tonight-v2:groupe-a": V2 });

    expect(readStoredTonight(storage, "groupe-a")).toBe(V2);
    expect(readStoredTonight(storage, "groupe-b")).toBeNull();
  });

  it("ne relit plus la clé d'avant les groupes", () => {
    expect(
      readStoredTonight(storageWith({ "ww-tonight-v1": V1 }), "nous-deux"),
    ).toBeNull();
  });
});
