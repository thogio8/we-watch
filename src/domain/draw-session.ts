/**
 * Picks floor(roll * eligible.length) among the candidates that are not
 * excluded, in the order received. roll ∈ [0, 1). Null if nothing is eligible.
 */
export function pickMovieId(
  candidateIds: readonly number[],
  excluded: ReadonlySet<number>,
  roll: number,
): number | null {
  const eligible = candidateIds.filter((id) => !excluded.has(id));
  return eligible[Math.floor(roll * eligible.length)] ?? null;
}

type DrawPhase = "home" | "result" | "exhausted" | "empty";

export interface DrawSessionState {
  phase: DrawPhase;
  currentId: number | null;
  pile: readonly number[];
}

export const initialDrawSession: DrawSessionState = {
  phase: "home",
  currentId: null,
  pile: [],
};

export type DrawSessionAction =
  | { type: "draw"; candidateIds: readonly number[]; roll: number }
  /** Current movie goes to the pile, then a new one is drawn. */
  | { type: "reject"; candidateIds: readonly number[]; roll: number }
  /** Empties the pile, then draws. */
  | { type: "reset_pile"; candidateIds: readonly number[]; roll: number }
  /** Empties the pile and the current movie, back to home. */
  | { type: "watched" }
  /** Back to home; the pile is kept for the rest of the session. */
  | { type: "back_home" }
  /** « ↺ RESSORTIR »: the last torn movie still eligible is drawn again. */
  | { type: "unreject"; candidateIds: readonly number[] };

/** The last torn movie that still suits tonight, or null. */
export function lastTornId(
  pile: readonly number[],
  candidateIds: readonly number[],
): number | null {
  return pile.findLast((id) => candidateIds.includes(id)) ?? null;
}

function unreject(
  state: DrawSessionState,
  candidateIds: readonly number[],
): DrawSessionState {
  const id = lastTornId(state.pile, candidateIds);
  if (id === null) return state;
  // The movie it replaces was drawn by chance: it does not join the pile.
  const pile = state.pile.filter((tornId) => tornId !== id);
  return { phase: "result", currentId: id, pile };
}

function drawFrom(
  candidateIds: readonly number[],
  pile: readonly number[],
  roll: number,
): DrawSessionState {
  if (candidateIds.length === 0) {
    return { phase: "empty", currentId: null, pile };
  }
  const id = pickMovieId(candidateIds, new Set(pile), roll);
  return id === null
    ? { phase: "exhausted", currentId: null, pile }
    : { phase: "result", currentId: id, pile };
}

export function drawSessionReducer(
  state: DrawSessionState,
  action: DrawSessionAction,
): DrawSessionState {
  switch (action.type) {
    case "draw":
      return drawFrom(action.candidateIds, state.pile, action.roll);
    case "reject": {
      const pile =
        state.currentId === null
          ? state.pile
          : [...state.pile, state.currentId];
      return drawFrom(action.candidateIds, pile, action.roll);
    }
    case "reset_pile":
      return drawFrom(action.candidateIds, [], action.roll);
    case "watched":
      return initialDrawSession;
    case "back_home":
      return { phase: "home", currentId: null, pile: state.pile };
    case "unreject":
      return unreject(state, action.candidateIds);
  }
}
