import { describe, expect, it } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import type { DrawSessionState } from "@/domain/draw-session";
import { NO_FILTERS, type TonightFilters } from "@/domain/tonight";
import {
  drawButton,
  exhaustedText,
  homeCounts,
  plural,
  resolveView,
  viewKey,
} from "./drawView";

const A = aMovie(1);
const B = aMovie(2);

const session = (
  phase: DrawSessionState["phase"],
  over: Partial<DrawSessionState> = {},
): DrawSessionState => ({ phase, currentId: null, pile: [], ...over });

describe("resolveView", () => {
  it("accueil : reste à l’accueil", () => {
    expect(resolveView(session("home"), [A], [A])).toEqual({ phase: "home" });
  });

  it("résultat : montre le film tiré s’il est encore dans la liste", () => {
    const state = session("result", { currentId: 1 });
    expect(resolveView(state, [A, B], [A, B])).toEqual({
      phase: "result",
      movie: A,
    });
  });

  it("résultat : un film disparu de la liste renvoie à l’accueil", () => {
    const state = session("result", { currentId: 3 });
    expect(resolveView(state, [A], [A])).toEqual({ phase: "home" });
  });

  it("épuisé : reste épuisé tant que tous les films éligibles sont écartés", () => {
    const state = session("exhausted", { pile: [1, 2] });
    expect(resolveView(state, [A, B], [A, B])).toEqual({ phase: "exhausted" });
  });

  it("épuisé : un nouveau film éligible renvoie à l’accueil", () => {
    const state = session("exhausted", { pile: [1] });
    expect(resolveView(state, [A, B], [A, B])).toEqual({ phase: "home" });
  });

  it("épuisé : aucun film éligible renvoie à l’accueil", () => {
    const state = session("exhausted", { pile: [1] });
    expect(resolveView(state, [A], [])).toEqual({ phase: "home" });
  });

  it("épuisé : une liste vidée montre l’écran vide", () => {
    const state = session("exhausted", { pile: [1] });
    expect(resolveView(state, [], [])).toEqual({ phase: "empty" });
  });

  it("vide : reste vide tant que la liste l’est, sinon accueil", () => {
    expect(resolveView(session("empty"), [], [])).toEqual({ phase: "empty" });
    expect(resolveView(session("empty"), [A], [A])).toEqual({ phase: "home" });
  });
});

describe("viewKey", () => {
  it("chaque film tiré a sa propre clé, les autres vues leur phase", () => {
    expect(viewKey({ phase: "result", movie: B })).toBe("result-2");
    expect(viewKey({ phase: "exhausted" })).toBe("exhausted");
  });
});

describe("plural", () => {
  it("accorde selon le nombre", () => {
    expect(plural(0, "film", "films")).toBe("0 film");
    expect(plural(1, "film", "films")).toBe("1 film");
    expect(plural(2, "vu", "vus")).toBe("2 vus");
  });
});

describe("exhaustedText", () => {
  it("sans filtre : parle de la liste", () => {
    expect(exhaustedText(1, false)).toBe(
      "Le seul film de la liste est passé à la trappe",
    );
    expect(exhaustedText(3, false)).toBe("Les 3 films sont passés à la trappe");
  });

  it("avec filtres : parle des films qui collaient", () => {
    expect(exhaustedText(1, true)).toBe(
      "Le seul film qui collait est passé à la trappe",
    );
    expect(exhaustedText(2, true)).toBe(
      "Les 2 films qui collaient sont passés à la trappe",
    );
  });
});

describe("drawButton", () => {
  it.each<
    [TonightFilters, number, { lines: string[]; tone: "yellow" | "pink" }]
  >([
    [NO_FILTERS, 5, { lines: ["TIRER", "UN", "FILM"], tone: "yellow" }],
    [
      { ...NO_FILTERS, moods: ["laugh"] },
      2,
      { lines: ["TIRER", "PARMI 2"], tone: "yellow" },
    ],
    [
      { ...NO_FILTERS, pool: "favorites" },
      2,
      { lines: ["TIRER", "UN COUP", "DE CŒUR"], tone: "pink" },
    ],
    [
      { ...NO_FILTERS, pool: "favorites", moods: ["laugh"] },
      1,
      { lines: ["TIRER", "PARMI 1"], tone: "pink" },
    ],
    [
      { ...NO_FILTERS, pool: "matches" },
      2,
      { lines: ["TIRER", "UN MATCH"], tone: "yellow" },
    ],
    [
      { ...NO_FILTERS, pool: "matches", moods: ["laugh"] },
      1,
      { lines: ["TIRER", "PARMI 1"], tone: "yellow" },
    ],
  ])("drawButton(%o, %i)", (filters, count, expected) => {
    expect(drawButton(filters, count)).toEqual(expected);
  });
});

describe("homeCounts", () => {
  it("« dont k ♥ » seulement s’il y a des coups de cœur", () => {
    expect(
      homeCounts({ toWatch: 3, watched: 0, favorites: 0, matches: 0 }),
    ).toBe("3 films à regarder · 0 vu");
    expect(
      homeCounts({ toWatch: 5, watched: 1, favorites: 2, matches: 0 }),
    ).toBe("5 films à regarder · dont 2 ♥ · 1 vu");
  });

  it("« dont k match(s) » après les ♥, seulement s’il y en a", () => {
    expect(
      homeCounts({ toWatch: 5, watched: 1, favorites: 0, matches: 1 }),
    ).toBe("5 films à regarder · dont 1 match · 1 vu");
    expect(
      homeCounts({ toWatch: 5, watched: 1, favorites: 2, matches: 2 }),
    ).toBe("5 films à regarder · dont 2 ♥ · dont 2 matchs · 1 vu");
  });

  it("met « vus » au pluriel dès deux films vus", () => {
    expect(
      homeCounts({ toWatch: 1, watched: 2, favorites: 0, matches: 0 }),
    ).toBe("1 film à regarder · 2 vus");
  });
});

describe("resolveView et coup de cœur", () => {
  it("le film tiré qui cesse d’être coup de cœur reste affiché, à jour", () => {
    const fav = aMovie(1, { favoriteAt: new Date(2026, 10, 4) });
    const state = session("result", { currentId: 1 });
    expect(resolveView(state, [fav], [fav])).toEqual({
      phase: "result",
      movie: fav,
    });
    const unmarked = aMovie(1);
    expect(resolveView(state, [unmarked], [])).toEqual({
      phase: "result",
      movie: unmarked,
    });
  });
});
