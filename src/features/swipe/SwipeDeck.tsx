"use client";

import { type ReactNode, useCallback, useReducer, useRef } from "react";
import { type DeckId, deckLabel } from "@/tmdb/decks";
import type {
  LoadCards,
  LoadMoreResult,
  SendDecision,
  SendUndo,
} from "./actions";
import { CardStack } from "./CardStack";
import { DeckChips } from "./DeckChips";
import { DeckNotice } from "./DeckNotice";
import { deckReducer, deckView, initDeck } from "./deckState";
import { DeckEnd, DeckError, LoadingTicket } from "./DeckStatus";
import { MatchMoment } from "./MatchMoment";
import styles from "./SwipeDeck.module.css";
import { useDeckLoader } from "./useDeckLoader";
import { useDismissAfter } from "./useDismissAfter";
import { useFocusOnClose } from "./useFocusOnClose";
import { useSwipeSync } from "./useSwipeSync";

interface SwipeDeckProps {
  deck: DeckId;
  initial: LoadMoreResult;
  decide: SendDecision;
  undo: SendUndo;
  loadMore: LoadCards;
  /** Members of the group, me included. */
  groupSize: number;
  /** The group pill, first in the landmark. */
  pill?: ReactNode;
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
  groupSize,
  pill,
}: SwipeDeckProps) {
  const [state, dispatch] = useReducer(deckReducer, initial, initDeck);
  const { queue, toast, undoable, match } = state;
  const screenRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLElement>(null);
  useDeckLoader(deck, state, dispatch, loadMore);
  useDismissAfter(toast, TOAST_MS, dispatch, "dismiss_toast");
  // « ↺ ANNULER » waits while the match moment is open: it undoes the match.
  useDismissAfter(match ? null : undoable, UNDO_MS, dispatch, "dismiss_undo");
  useFocusOnClose(match !== null, [deckRef, screenRef]);
  const closeMatch = useCallback(() => dispatch({ type: "match_closed" }), []);
  const { decideCard, undoLast } = useSwipeSync(
    undoable,
    dispatch,
    decide,
    undo,
  );

  const view = deckView(state);

  return (
    <main ref={screenRef} tabIndex={-1} className={styles.screen}>
      {pill}
      <h1 className={styles.kicker}>{deckLabel(deck)}</h1>
      <DeckChips deck={deck} />

      {view === "cards" && (
        <CardStack
          queue={queue}
          lastDecision={state.lastDecision}
          groupSize={groupSize}
          onDecide={decideCard}
          deckRef={deckRef}
        />
      )}
      {view === "loading" && <LoadingTicket />}
      {view === "end" && <DeckEnd />}
      {view === "error" && (
        <DeckError onRetry={() => dispatch({ type: "retry" })} />
      )}

      {match && <MatchMoment onClose={closeMatch} />}
      <DeckNotice toast={toast} undoable={undoable} onUndo={undoLast} />
    </main>
  );
}

/**
 * Shown while the first batch loads on the server. `deck` is null in the
 * static shell, before the request's `?deck=` is read.
 */
export function SwipeDeckFallback({
  deck,
  pill,
}: {
  deck: DeckId | null;
  pill?: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      {pill}
      <h1 className={styles.kicker}>{deck === null ? " " : deckLabel(deck)}</h1>
      <DeckChips deck={deck} />
      <LoadingTicket />
    </main>
  );
}
