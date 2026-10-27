"use client";

import { useReducer } from "react";
import { type DeckId, deckLabel } from "@/tmdb/decks";
import type {
  decideSwipe,
  LoadMoreResult,
  loadMoreCards,
  undoSwipe,
} from "./actions";
import { CardStack } from "./CardStack";
import { DeckChips } from "./DeckChips";
import { DeckNotice } from "./DeckNotice";
import { deckReducer, deckView, initDeck } from "./deckState";
import { DeckEnd, DeckError, LoadingTicket } from "./DeckStatus";
import styles from "./SwipeDeck.module.css";
import { useDeckLoader } from "./useDeckLoader";
import { useDismissAfter } from "./useDismissAfter";
import { useSwipeSync } from "./useSwipeSync";

interface SwipeDeckProps {
  deck: DeckId;
  initial: LoadMoreResult;
  decide: typeof decideSwipe;
  undo: typeof undoSwipe;
  loadMore: typeof loadMoreCards;
}

const TOAST_MS = 4000;
/** How long « ↺ ANNULER » stays offered after a swipe. */
const UNDO_MS = 5000;

export function SwipeDeck({
  deck,
  initial,
  decide,
  undo,
  loadMore,
}: SwipeDeckProps) {
  const [state, dispatch] = useReducer(deckReducer, initial, initDeck);
  const { queue, toast, undoable } = state;
  useDeckLoader(deck, state, dispatch, loadMore);
  useDismissAfter(toast, TOAST_MS, dispatch, "dismiss_toast");
  useDismissAfter(undoable, UNDO_MS, dispatch, "dismiss_undo");
  const { decideCard, undoLast } = useSwipeSync(
    undoable,
    dispatch,
    decide,
    undo,
  );

  const view = deckView(state);

  return (
    <main className={styles.screen}>
      <h1 className={styles.kicker}>{deckLabel(deck)}</h1>
      <DeckChips deck={deck} />

      {view === "cards" && (
        <CardStack
          queue={queue}
          lastDecision={state.lastDecision}
          onDecide={decideCard}
        />
      )}
      {view === "loading" && <LoadingTicket />}
      {view === "end" && <DeckEnd />}
      {view === "error" && (
        <DeckError onRetry={() => dispatch({ type: "retry" })} />
      )}

      <DeckNotice toast={toast} undoable={undoable} onUndo={undoLast} />
    </main>
  );
}

/**
 * Shown while the first batch loads on the server. `deck` is null in the
 * static shell, before the request's `?deck=` is read.
 */
export function SwipeDeckFallback({ deck }: { deck: DeckId | null }) {
  return (
    <main className={styles.screen}>
      <h1 className={styles.kicker}>{deck === null ? " " : deckLabel(deck)}</h1>
      <DeckChips deck={deck} />
      <LoadingTicket />
    </main>
  );
}
