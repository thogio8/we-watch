import { describe, expect, it } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import type { DrawSessionState } from "@/domain/draw-session";
import { exhaustedText, plural, resolveView, viewKey } from "./drawView";

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
