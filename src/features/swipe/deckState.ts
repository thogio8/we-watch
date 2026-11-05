import type { LoadMoreResult, SwipeDecision } from "./actions";
import type { DeckBatch, DeckCard } from "./deck";

export type Toast = "save_failed" | "undo_failed";

export interface DeckState {
  queue: DeckCard[];
  /** Next TMDB page to load; null once the last page has been read. */
  nextPage: number | null;
  /** The last load failed: no automatic retry until « RÉESSAYER ». */
  loadFailed: boolean;
  /** Ids decided in this session, saved or still saving. */
  decided: ReadonlySet<number>;
  /** Direction the last decided card leaves in. */
  lastDecision: SwipeDecision;
  /** The swipe « ↺ ANNULER » would take back, null once dismissed. */
  undoable: { card: DeckCard; decision: SwipeDecision } | null;
  /** Failure currently reported, null when no message. */
  toast: Toast | null;
  /** The card my swipe made a match of, as the server said; null when closed. */
  match: DeckCard | null;
}

export type DeckAction =
  | { type: "loaded"; batch: DeckBatch }
  | { type: "load_failed" }
  | { type: "retry" }
  | { type: "decided"; card: DeckCard; decision: SwipeDecision }
  | { type: "decide_failed"; card: DeckCard }
  | { type: "matched"; card: DeckCard }
  | { type: "match_closed" }
  | { type: "undone" }
  | { type: "undo_failed"; tmdbId: number }
  | { type: "dismiss_undo" }
  | { type: "dismiss_toast" };

type Handlers = {
  [T in DeckAction["type"]]: (
    state: DeckState,
    action: Extract<DeckAction, { type: T }>,
  ) => DeckState;
};

/** The card leaves the queue, decided (swiped, or kept after a failed undo). */
function takeOut(state: DeckState, tmdbId: number): DeckState {
  return {
    ...state,
    queue: state.queue.filter((card) => card.tmdbId !== tmdbId),
    decided: new Set(state.decided).add(tmdbId),
  };
}

/** The card is back on top, undecided (failed save or « ↺ ANNULER »). */
function putBack(state: DeckState, card: DeckCard): DeckState {
  const decided = new Set(state.decided);
  decided.delete(card.tmdbId);
  const others = state.queue.filter((c) => c.tmdbId !== card.tmdbId);
  return { ...state, queue: [card, ...others], decided };
}

const handlers: Handlers = {
  loaded: (state, { batch }) => {
    // TMDB's order can shift between pages: never show a card twice, nor
    // one already decided here (its save may not be in the database yet).
    const known = new Set([
      ...state.decided,
      ...state.queue.map((card) => card.tmdbId),
    ]);
    const fresh = batch.cards.filter((card) => {
      if (known.has(card.tmdbId)) return false;
      known.add(card.tmdbId);
      return true;
    });
    // A page that brings nothing new and does not move on (TMDB down, the
    // queue served again) would never be asked for again: offer « RÉESSAYER ».
    const stuck = fresh.length === 0 && batch.nextPage === state.nextPage;
    return {
      ...state,
      queue: [...state.queue, ...fresh],
      nextPage: batch.nextPage,
      loadFailed: stuck,
    };
  },
  load_failed: (state) => ({ ...state, loadFailed: true }),
  retry: (state) => ({ ...state, loadFailed: false }),
  decided: (state, { card, decision }) => ({
    ...takeOut(state, card.tmdbId),
    lastDecision: decision,
    undoable: { card, decision },
    toast: null,
  }),
  decide_failed: (state, { card }) => {
    // The card comes back on top, to be decided again: nothing to undo.
    const undoable =
      state.undoable?.card.tmdbId === card.tmdbId ? null : state.undoable;
    return { ...putBack(state, card), undoable, toast: "save_failed" };
  },
  matched: (state, { card }) => ({ ...state, match: card }),
  match_closed: (state) => ({ ...state, match: null }),
  undone: (state) => {
    if (state.undoable === null) return state;
    const { card } = state.undoable;
    // Undoing the swipe that made the match undoes the match: no more moment.
    const match = state.match?.tmdbId === card.tmdbId ? null : state.match;
    return { ...putBack(state, card), undoable: null, match };
  },
  // The decision is still saved: the card leaves again, as decided.
  undo_failed: (state, { tmdbId }) => ({
    ...takeOut(state, tmdbId),
    toast: "undo_failed",
  }),
  dismiss_undo: (state) => ({ ...state, undoable: null }),
  dismiss_toast: (state) => ({ ...state, toast: null }),
};

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  const handle = handlers[action.type] as (
    state: DeckState,
    action: DeckAction,
  ) => DeckState;
  return handle(state, action);
}

export function initDeck(initial: LoadMoreResult): DeckState {
  const empty: DeckState = {
    queue: [],
    nextPage: 1,
    loadFailed: false,
    decided: new Set(),
    lastDecision: "keep",
    undoable: null,
    toast: null,
    match: null,
  };
  return initial.ok
    ? deckReducer(empty, { type: "loaded", batch: initial.batch })
    : { ...empty, loadFailed: true };
}

export type DeckView = "cards" | "end" | "error" | "loading";

/** Cards on screen; otherwise, why there are none. */
export function deckView(state: DeckState): DeckView {
  if (state.queue.length > 0) return "cards";
  if (state.nextPage === null) return "end";
  return state.loadFailed ? "error" : "loading";
}
