import { describe, expect, it } from "vitest";
import { genreNames } from "./genres";

describe("genreNames", () => {
  it("donne les genres TMDB en français, dans l'ordre", () =>
    expect(genreNames([35, 53, 18])).toEqual(["Comédie", "Thriller", "Drame"]));

  it("ignore un genre inconnu plutôt que d'afficher un numéro", () =>
    expect(genreNames([16, 999])).toEqual(["Animation"]));
});
