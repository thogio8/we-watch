import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  drawSessionReducer,
  initialDrawSession,
  pickMovieId,
  type DrawSessionAction,
  type DrawSessionState,
} from "./draw-session";

const ids = fc.uniqueArray(fc.integer({ min: 0, max: 12 }), { maxLength: 8 });
const roll = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

const action: fc.Arbitrary<DrawSessionAction> = fc.oneof(
  fc.record({
    type: fc.constantFrom("draw", "reject", "reset_pile"),
    candidateIds: ids,
    roll,
  }),
  fc.record({ type: fc.constant("unreject"), candidateIds: ids }),
  fc.constantFrom({ type: "watched" }, { type: "back_home" }),
) as fc.Arbitrary<DrawSessionAction>;

describe("pickMovieId (propriétés)", () => {
  it("ne rend qu'un film de la liste, jamais un film écarté", () =>
    fc.assert(
      fc.property(
        ids,
        fc.uniqueArray(fc.integer({ min: 0, max: 12 })),
        roll,
        (candidates, out, r) => {
          const picked = pickMovieId(candidates, new Set(out), r);
          if (picked !== null) {
            expect(candidates).toContain(picked);
            expect(out).not.toContain(picked);
          }
        },
      ),
    ));

  it("rend un film dès qu'il en reste un d'éligible, et seulement alors", () =>
    fc.assert(
      fc.property(
        ids,
        fc.uniqueArray(fc.integer({ min: 0, max: 12 })),
        roll,
        (candidates, out, r) => {
          const left = candidates.filter((id) => !out.includes(id));
          expect(pickMovieId(candidates, new Set(out), r) !== null).toBe(
            left.length > 0,
          );
        },
      ),
    ));
});

describe("drawSessionReducer (propriétés)", () => {
  const invariant = (state: DrawSessionState) => {
    expect(new Set(state.pile).size).toBe(state.pile.length);
    if (state.phase === "result") {
      expect(state.currentId).not.toBeNull();
      expect(state.pile).not.toContain(state.currentId);
    } else {
      expect(state.currentId).toBeNull();
    }
  };

  it("après toute suite d'actions, le film tiré n'est jamais dans la pile et la pile n'a pas de doublon", () =>
    fc.assert(
      fc.property(fc.array(action, { maxLength: 25 }), (actions) => {
        let state = initialDrawSession;
        for (const a of actions) {
          state = drawSessionReducer(state, a);
          invariant(state);
        }
      }),
    ));

  it("un tirage donne un film de la liste, ou « empty » / « exhausted » selon ce qu'il reste", () =>
    fc.assert(
      fc.property(ids, ids, roll, (candidates, pile, r) => {
        const state = drawSessionReducer(
          { phase: "home", currentId: null, pile },
          { type: "draw", candidateIds: candidates, roll: r },
        );
        const left = candidates.filter((id) => !pile.includes(id));
        if (candidates.length === 0) expect(state.phase).toBe("empty");
        else if (left.length === 0) expect(state.phase).toBe("exhausted");
        else {
          expect(state.phase).toBe("result");
          expect(left).toContain(state.currentId);
        }
      }),
    ));

  it("rejeter ne redonne jamais le même film", () =>
    fc.assert(
      fc.property(ids, ids, roll, (candidates, pile, r) => {
        const drawn = drawSessionReducer(
          { phase: "home", currentId: null, pile },
          { type: "draw", candidateIds: candidates, roll: r },
        );
        const next = drawSessionReducer(drawn, {
          type: "reject",
          candidateIds: candidates,
          roll: r,
        });
        if (next.phase === "result") {
          expect(next.currentId).not.toBe(drawn.currentId);
        }
      }),
    ));
});
