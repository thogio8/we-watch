import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aSnapshot } from "../../tests/helpers/movies";
import {
  fitsBefore,
  filterTonight,
  MOODS,
  NO_FILTERS,
  platformKey,
  sanitizeFilters,
  tonightPlatforms,
  type TonightFilters,
} from "./tonight";

const PROVIDER_NAMES = [
  "Netflix",
  "Netflix Standard with Ads",
  "Canal+",
  "Paramount Plus Premium",
  "Disney Plus",
];

const movie = fc
  .record({
    runtime: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
    genreIds: fc.uniqueArray(fc.constantFrom(35, 27, 18, 99, 12, 1), {
      maxLength: 4,
    }),
    names: fc.uniqueArray(fc.constantFrom(...PROVIDER_NAMES), { maxLength: 3 }),
  })
  .map(({ runtime, genreIds, names }) =>
    aSnapshot(0, {
      runtimeMinutes: runtime,
      genreIds,
      providers: names.map((name, id) => ({ id, name, logoPath: null })),
    }),
  );

const movies = fc
  .array(movie, { maxLength: 8 })
  .map((list) => list.map((m, i) => ({ ...m, tmdbId: i })));

const filters: fc.Arbitrary<TonightFilters> = fc.record({
  bedtime: fc.option(fc.integer({ min: 20 * 60, max: 26 * 60 }), { nil: null }),
  moods: fc.uniqueArray(fc.constantFrom(...MOODS.map((m) => m.id))),
  platforms: fc.uniqueArray(
    fc.constantFrom(...PROVIDER_NAMES.map(platformKey)),
  ),
});

const now = fc.date({
  min: new Date(2026, 0, 1),
  max: new Date(2027, 0, 1),
  noInvalidDate: true,
});

describe("filterTonight (propriétés)", () => {
  it("pour toute liste et tout filtre, filtrer ne rajoute jamais de film", () =>
    fc.assert(
      fc.property(movies, filters, now, (list, f, d) => {
        const kept = filterTonight(list, f, d);
        expect(kept.length).toBeLessThanOrEqual(list.length);
        for (const m of kept) expect(list).toContain(m);
      }),
    ));

  it("sans filtre, rien n'est retiré", () =>
    fc.assert(
      fc.property(movies, now, (list, d) => {
        expect(filterTonight(list, NO_FILTERS, d)).toEqual(list);
      }),
    ));

  it("chaque film gardé respecte chaque filtre actif", () =>
    fc.assert(
      fc.property(movies, filters, now, (list, f, d) => {
        const genres = MOODS.filter((m) => f.moods.includes(m.id)).flatMap(
          (m) => m.genreIds as readonly number[],
        );
        for (const m of filterTonight(list, f, d)) {
          if (f.bedtime !== null) {
            expect(fitsBefore(m.runtimeMinutes, d, f.bedtime)).toBe(true);
          }
          if (f.moods.length > 0) {
            expect(m.genreIds.some((g) => genres.includes(g))).toBe(true);
          }
          if (f.platforms.length > 0) {
            const keys = m.providers.map((p) => platformKey(p.name));
            expect(keys.some((k) => f.platforms.includes(k))).toBe(true);
          }
        }
      }),
    ));
});

describe("fitsBefore (propriétés)", () => {
  it("un film plus court qui tient avant le coucher tient encore", () =>
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 1, max: 300 }),
        now,
        fc.integer({ min: 20 * 60, max: 26 * 60 }),
        (a, b, d, bedtime) => {
          const [short, long] = a < b ? [a, b] : [b, a];
          if (fitsBefore(long, d, bedtime)) {
            expect(fitsBefore(short, d, bedtime)).toBe(true);
          }
        },
      ),
    ));
});

describe("plateformes (propriétés)", () => {
  it("platformKey est idempotent, même avec plusieurs suffixes d'offre", () =>
    fc.assert(
      fc.property(
        // Single-spaced on purpose: names come from TMDB and keys are always
        // derived by platformKey; several inner spaces would leave trailing
        // blanks after the suffix strip (not idempotent, harmless).
        fc.array(
          fc.constantFrom(
            "Netflix",
            "Plus",
            "plus",
            "Premium",
            "with Ads",
            "Amazon Channel",
          ),
          { maxLength: 6 },
        ),
        (words) => {
          const name = words.join(" ");
          expect(platformKey(platformKey(name))).toBe(platformKey(name));
        },
      ),
    ));

  it("sanitizeFilters est idempotent et ne garde que des plateformes de la liste", () =>
    fc.assert(
      fc.property(movies, filters, (list, f) => {
        const once = sanitizeFilters(f, list);
        expect(sanitizeFilters(once, list)).toEqual(once);
        const known = tonightPlatforms(list).map((p) => p.key);
        for (const key of once.platforms) expect(known).toContain(key);
      }),
    ));
});
