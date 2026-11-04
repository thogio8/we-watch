import { describe, expect, it } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import { toWatchSections } from "./toWatchSections";

const NOV_4 = new Date(2026, 10, 4, 21, 0);
const fav = (tmdbId: number) =>
  aMovie(tmdbId, { favoriteAt: NOV_4, favoriteBy: "Becca" });

describe("toWatchSections", () => {
  it("sans coup de cœur : une seule section, sans intertitre, dans l’ordre reçu", () => {
    expect(toWatchSections([aMovie(1), aMovie(2)])).toEqual([
      { key: "all", title: null, movies: [aMovie(1), aMovie(2)] },
    ]);
  });

  it("des coups de cœur : leur intertitre puis « LE RESTE », chacun avec son compte", () => {
    expect(toWatchSections([fav(2), aMovie(1), aMovie(3)])).toEqual([
      { key: "favorites", title: "♥ COUPS DE CŒUR · 1", movies: [fav(2)] },
      { key: "rest", title: "LE RESTE · 2", movies: [aMovie(1), aMovie(3)] },
    ]);
  });

  it("tous coups de cœur : pas d’intertitre « LE RESTE »", () => {
    expect(toWatchSections([fav(1), fav(2)])).toEqual([
      {
        key: "favorites",
        title: "♥ COUPS DE CŒUR · 2",
        movies: [fav(1), fav(2)],
      },
    ]);
  });

  it("une liste vide : aucune section", () => {
    expect(toWatchSections([])).toEqual([]);
  });
});
