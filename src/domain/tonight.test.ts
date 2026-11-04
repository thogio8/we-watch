import { describe, expect, it } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import type { MovieSnapshot, StreamingProvider } from "./movie";
import {
  BEDTIMES,
  bedtimeDeadline,
  distinctPlatforms,
  filterTonight,
  fitsBefore,
  isFiltering,
  MOODS,
  NO_FILTERS,
  platformKey,
  sanitizeFilters,
  tonightPlatforms,
} from "./tonight";

/** Local time on 2026-10-27 (or the next day with dayOffset 1). */
const at = (hours: number, minutes = 0, dayOffset = 0) =>
  new Date(2026, 9, 27 + dayOffset, hours, minutes);

const NETFLIX: StreamingProvider = { id: 8, name: "Netflix", logoPath: null };
const PRIME: StreamingProvider = { id: 119, name: "Prime", logoPath: null };
const CANAL: StreamingProvider = { id: 381, name: "Canal+", logoPath: null };

const movie = aMovie;

const NOV_4 = new Date(2026, 10, 4, 21, 0);

const ids = (movies: readonly MovieSnapshot[]) => movies.map((m) => m.tmdbId);

describe("BEDTIMES", () => {
  it("de 22h30 à 1h, minuit compris", () => {
    expect(BEDTIMES.map((b) => b.label)).toEqual([
      "22H30",
      "23H",
      "23H30",
      "MINUIT",
      "1H",
    ]);
  });
});

describe("bedtimeDeadline", () => {
  it("le soir même quand l'heure est devant", () => {
    expect(bedtimeDeadline(at(21, 7), 23 * 60 + 30)).toEqual(at(23, 30));
  });

  it("minuit et 1h tombent le lendemain", () => {
    expect(bedtimeDeadline(at(21), 24 * 60)).toEqual(at(0, 0, 1));
    expect(bedtimeDeadline(at(21), 25 * 60)).toEqual(at(1, 0, 1));
  });

  it("après minuit, 1h reste la nuit en cours", () => {
    expect(bedtimeDeadline(at(0, 20, 1), 25 * 60)).toEqual(at(1, 0, 1));
  });

  it("une heure dépassée de peu reste dans le passé", () => {
    expect(bedtimeDeadline(at(23, 50), 23 * 60 + 30)).toEqual(at(23, 30));
    expect(bedtimeDeadline(at(1, 30, 1), 23 * 60 + 30)).toEqual(at(23, 30));
  });

  it("le matin, on vise le soir qui vient", () => {
    expect(bedtimeDeadline(at(9), 22 * 60 + 30)).toEqual(at(22, 30));
    expect(bedtimeDeadline(at(7, 1), 25 * 60)).toEqual(at(1, 0, 1));
  });
});

describe("fitsBefore", () => {
  it("garde un film qui finit pile à l'heure", () => {
    expect(fitsBefore(100, at(21, 50), 23 * 60 + 30)).toBe(true);
    expect(fitsBefore(101, at(21, 50), 23 * 60 + 30)).toBe(false);
  });

  it("rien ne rentre une fois l'heure passée", () => {
    expect(fitsBefore(1, at(23, 50), 23 * 60 + 30)).toBe(false);
  });

  it("durée inconnue : exclu", () => {
    expect(fitsBefore(null, at(12), 25 * 60)).toBe(false);
  });
});

describe("platformKey", () => {
  it.each([
    ["Netflix", "netflix"],
    ["Netflix Standard with Ads", "netflix"],
    ["Amazon Prime Video with Ads", "amazon prime video"],
    ["HBO Max Amazon Channel", "hbo max"],
    ["Paramount Plus", "paramount+"],
    ["Paramount Plus Premium", "paramount+"],
    ["Paramount+ Amazon Channel", "paramount+"],
    ["Disney Plus", "disney+"],
    ["Canal+", "canal+"],
    ["MGM Amazon Channel", "mgm"],
    ["Paramount Plus Premium Amazon Channel", "paramount+"],
    ["Plus Belle La Vie", "plus belle la vie"],
  ])("%s → %s", (name, key) => {
    expect(platformKey(name)).toBe(key);
  });
});

describe("tonightPlatforms", () => {
  it("une puce par plateforme, les plus fréquentes d'abord", () => {
    const ads = { id: 1796, name: "Netflix Standard with Ads", logoPath: null };
    const list = [
      movie(1, { providers: [PRIME] }),
      movie(2, { providers: [ads, NETFLIX, PRIME] }),
      movie(3, { providers: [CANAL] }),
      movie(4, { providers: [ads, PRIME] }),
    ];
    expect(tonightPlatforms(list)).toEqual([
      { key: "prime", name: "Prime" },
      { key: "netflix", name: "Netflix" },
      { key: "canal+", name: "Canal+" },
    ]);
  });

  it("à égalité, ordre alphabétique", () => {
    const list = [movie(1, { providers: [PRIME, CANAL] })];
    expect(tonightPlatforms(list).map((p) => p.name)).toEqual([
      "Canal+",
      "Prime",
    ]);
  });
});

describe("distinctPlatforms", () => {
  it("garde la première offre de chaque plateforme", () => {
    const ads = { id: 1796, name: "Netflix Standard with Ads", logoPath: null };
    expect(distinctPlatforms([ads, PRIME, NETFLIX])).toEqual([ads, PRIME]);
  });
});

describe("filterTonight", () => {
  const list = [
    movie(1, { runtimeMinutes: 90, genreIds: [35], providers: [NETFLIX] }),
    movie(2, { runtimeMinutes: 150, genreIds: [27], providers: [PRIME] }),
    movie(3, { runtimeMinutes: null, genreIds: [18], providers: [] }),
    movie(4, { runtimeMinutes: 95, genreIds: [53, 18], providers: [PRIME] }),
  ];

  it("sans filtre, toute la liste", () => {
    expect(ids(filterTonight(list, NO_FILTERS, at(21)))).toEqual([1, 2, 3, 4]);
  });

  it("heure de coucher", () => {
    const filters = { ...NO_FILTERS, bedtime: 23 * 60 };
    expect(ids(filterTonight(list, filters, at(21)))).toEqual([1, 4]);
  });

  it("humeurs en « ou »", () => {
    const laugh = { ...NO_FILTERS, moods: ["laugh" as const] };
    expect(ids(filterTonight(list, laugh, at(21)))).toEqual([1]);
    const both = { ...NO_FILTERS, moods: ["laugh", "chills"] as const };
    expect(ids(filterTonight(list, both, at(21)))).toEqual([1, 2, 4]);
  });

  it("plateformes en « ou »", () => {
    const filters = { ...NO_FILTERS, platforms: ["netflix", "prime"] };
    expect(ids(filterTonight(list, filters, at(21)))).toEqual([1, 2, 4]);
  });

  it("les filtres se cumulent", () => {
    const filters = {
      ...NO_FILTERS,
      bedtime: 24 * 60,
      moods: ["feel" as const],
      platforms: ["prime"],
    };
    expect(ids(filterTonight(list, filters, at(21)))).toEqual([4]);
  });
});

describe("sanitizeFilters", () => {
  it("oublie les plateformes absentes de la liste", () => {
    const list = [aMovie(1, { providers: [NETFLIX] })];
    const filters = { ...NO_FILTERS, platforms: ["netflix", "canal+"] };
    expect(sanitizeFilters(filters, list).platforms).toEqual(["netflix"]);
  });
});

describe("filtre coups de cœur", () => {
  it("seulement nos coups de cœur, cumulé avec les autres filtres", () => {
    const fav = aMovie(1, { favoriteAt: NOV_4, genreIds: [35] });
    const favDrama = aMovie(2, { favoriteAt: NOV_4, genreIds: [18] });
    const other = aMovie(3, { genreIds: [35] });
    const only = { ...NO_FILTERS, favoritesOnly: true };
    expect(filterTonight([fav, favDrama, other], only, at(21))).toEqual([
      fav,
      favDrama,
    ]);
    expect(
      filterTonight(
        [fav, favDrama, other],
        { ...only, moods: ["laugh"] },
        at(21),
      ),
    ).toEqual([fav]);
  });

  it("isFiltering compte le filtre coups de cœur", () => {
    expect(isFiltering({ ...NO_FILTERS, favoritesOnly: true })).toBe(true);
  });

  it("plus aucun coup de cœur : le filtre retombe à toute la liste", () => {
    const on = { ...NO_FILTERS, favoritesOnly: true };
    expect(sanitizeFilters(on, [aMovie(1)]).favoritesOnly).toBe(false);
    expect(
      sanitizeFilters(on, [aMovie(1, { favoriteAt: NOV_4 })]).favoritesOnly,
    ).toBe(true);
  });

  it("le dernier coup de cœur démarqué pendant le filtre : toute la liste revient", () => {
    const on = { ...NO_FILTERS, favoritesOnly: true };
    const list = [aMovie(1, { favoriteAt: NOV_4 }), aMovie(2)];
    expect(filterTonight(list, sanitizeFilters(on, list), at(21))).toEqual([
      list[0],
    ]);
    const unmarked = [aMovie(1), aMovie(2)];
    const after = sanitizeFilters(on, unmarked);
    expect(isFiltering(after)).toBe(false);
    expect(filterTonight(unmarked, after, at(21))).toEqual(unmarked);
  });

  it("filtre cumulé sans résultat : le retirer d’un coup remet toute la liste", () => {
    const list = [aMovie(1, { favoriteAt: NOV_4, genreIds: [18] }), aMovie(2)];
    const combined = {
      ...NO_FILTERS,
      favoritesOnly: true,
      moods: ["laugh" as const],
    };
    expect(filterTonight(list, combined, at(21))).toEqual([]);
    expect(NO_FILTERS.favoritesOnly).toBe(false);
    expect(filterTonight(list, NO_FILTERS, at(21))).toEqual(list);
  });
});

describe("isFiltering", () => {
  it("vrai dès qu'un filtre est actif", () => {
    expect(isFiltering(NO_FILTERS)).toBe(false);
    expect(isFiltering({ ...NO_FILTERS, bedtime: 1380 })).toBe(true);
    expect(isFiltering({ ...NO_FILTERS, moods: ["think"] })).toBe(true);
    expect(isFiltering({ ...NO_FILTERS, platforms: ["netflix"] })).toBe(true);
  });
});

describe("MOODS", () => {
  it("cinq humeurs, chacune avec des genres", () => {
    expect(MOODS.map((m) => m.label)).toEqual([
      "RIRE",
      "FRISSONNER",
      "S’ÉMOUVOIR",
      "RÉFLÉCHIR",
      "S’ÉVADER",
    ]);
    for (const mood of MOODS) expect(mood.genreIds.length).toBeGreaterThan(0);
  });
});
