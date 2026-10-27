import { describe, expect, it } from "vitest";
import {
  drawSessionReducer,
  initialDrawSession,
  lastTornId,
  pickMovieId,
} from "./draw-session";

describe("pickMovieId", () => {
  it("ignore les exclus", () =>
    expect(pickMovieId([1, 2, 3], new Set([1, 2]), 0.99)).toBe(3));
  it("sans éligible → null", () =>
    expect(pickMovieId([1], new Set([1]), 0)).toBeNull());
  it("respecte roll", () =>
    expect(pickMovieId([10, 20, 30, 40], new Set(), 0.5)).toBe(30));
});

describe("drawSessionReducer", () => {
  it("draw sur liste vide → phase empty", () =>
    expect(
      drawSessionReducer(initialDrawSession, {
        type: "draw",
        candidateIds: [],
        roll: 0,
      }).phase,
    ).toBe("empty"));
  it("draw → result avec currentId", () =>
    expect(
      drawSessionReducer(initialDrawSession, {
        type: "draw",
        candidateIds: [7],
        roll: 0,
      }),
    ).toEqual({ phase: "result", currentId: 7, pile: [] }));
  it("reject empile le courant et ne le retire pas", () => {
    const s = { phase: "result", currentId: 1, pile: [] } as const;
    expect(
      drawSessionReducer(s, { type: "reject", candidateIds: [1, 2], roll: 0 }),
    ).toEqual({ phase: "result", currentId: 2, pile: [1] });
  });
  it("reject du dernier éligible → exhausted", () => {
    const s = { phase: "result", currentId: 2, pile: [1] } as const;
    expect(
      drawSessionReducer(s, { type: "reject", candidateIds: [1, 2], roll: 0 }),
    ).toEqual({ phase: "exhausted", currentId: null, pile: [1, 2] });
  });
  it("un film ajouté entre-temps est tirable sans vider la pile", () => {
    const s = { phase: "exhausted", currentId: null, pile: [1, 2] } as const;
    expect(
      drawSessionReducer(s, {
        type: "draw",
        candidateIds: [1, 2, 3],
        roll: 0,
      }),
    ).toEqual({ phase: "result", currentId: 3, pile: [1, 2] });
  });
  it("reset_pile vide la pile et retire", () => {
    const s = { phase: "exhausted", currentId: null, pile: [1] } as const;
    expect(
      drawSessionReducer(s, {
        type: "reset_pile",
        candidateIds: [1],
        roll: 0,
      }),
    ).toEqual({ phase: "result", currentId: 1, pile: [] });
  });
  it("reset_pile sur liste vide → empty", () =>
    expect(
      drawSessionReducer(
        { phase: "exhausted", currentId: null, pile: [1] },
        { type: "reset_pile", candidateIds: [], roll: 0 },
      ),
    ).toEqual({ phase: "empty", currentId: null, pile: [] }));
  it("reject sans film courant n'empile rien", () =>
    expect(
      drawSessionReducer(initialDrawSession, {
        type: "reject",
        candidateIds: [4],
        roll: 0,
      }),
    ).toEqual({ phase: "result", currentId: 4, pile: [] }));
  it("watched remet tout à zéro", () =>
    expect(
      drawSessionReducer(
        { phase: "result", currentId: 1, pile: [2, 3] },
        { type: "watched" },
      ),
    ).toEqual(initialDrawSession));
  it("back_home revient à l'accueil en gardant la pile", () =>
    expect(
      drawSessionReducer(
        { phase: "result", currentId: 1, pile: [2] },
        { type: "back_home" },
      ),
    ).toEqual({ phase: "home", currentId: null, pile: [2] }));
});

describe("ressortir le dernier ticket déchiré", () => {
  const torn = { phase: "result", currentId: 9, pile: [3, 5] } as const;

  it("le dernier déchiré redevient le ticket tiré et quitte la pile", () =>
    expect(
      drawSessionReducer(torn, { type: "unreject", candidateIds: [3, 5, 9] }),
    ).toEqual({ phase: "result", currentId: 5, pile: [3] }));

  it("le ticket remplacé ne part pas dans la pile", () =>
    expect(
      drawSessionReducer(torn, { type: "unreject", candidateIds: [3, 5, 9] })
        .pile,
    ).not.toContain(9));

  it("saute les déchirés qui ne collent plus aux filtres", () =>
    expect(
      drawSessionReducer(torn, { type: "unreject", candidateIds: [3, 9] }),
    ).toEqual({ phase: "result", currentId: 3, pile: [5] }));

  it("depuis « difficiles ce soir », ressort aussi", () =>
    expect(
      drawSessionReducer(
        { phase: "exhausted", currentId: null, pile: [3, 5] },
        { type: "unreject", candidateIds: [3, 5] },
      ),
    ).toEqual({ phase: "result", currentId: 5, pile: [3] }));

  it("rien à ressortir : rien ne change", () => {
    const state = { phase: "result", currentId: 9, pile: [3] } as const;
    expect(
      drawSessionReducer(state, { type: "unreject", candidateIds: [9] }),
    ).toBe(state);
  });

  it("lastTornId : le dernier déchiré encore éligible, sinon null", () => {
    expect(lastTornId([3, 5], [3, 5])).toBe(5);
    expect(lastTornId([3, 5], [3])).toBe(3);
    expect(lastTornId([3, 5], [9])).toBeNull();
    expect(lastTornId([], [9])).toBeNull();
  });
});
