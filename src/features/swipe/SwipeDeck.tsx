"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { MovieSnapshot } from "@/domain/movie";
import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { Lines } from "@/ui/Lines";
import { Ticket } from "@/ui/Ticket";
import type {
  decideSwipe,
  LoadMoreResult,
  loadMoreCards,
  SwipeDecision,
} from "./actions";
import type { DeckBatch } from "./deck";
import { POSTER_HEIGHT, SwipeCard } from "./SwipeCard";
import styles from "./SwipeDeck.module.css";

interface SwipeDeckProps {
  initial: LoadMoreResult;
  decide: typeof decideSwipe;
  loadMore: typeof loadMoreCards;
}

/** Below this many queued cards, the next page is fetched. */
const PRELOAD_BELOW = 3;
const TOAST_MS = 4000;

interface DeckState {
  queue: MovieSnapshot[];
  /** Next TMDB page to load; null once the last page has been read. */
  nextPage: number | null;
  /** The last load failed: no automatic retry until « RÉESSAYER ». */
  loadFailed: boolean;
  /** Ids decided in this session, saved or still saving. */
  decided: ReadonlySet<number>;
  /** Direction the last decided card leaves in. */
  lastDecision: SwipeDecision;
  /** Id of the failed save currently reported, null when no message. */
  toast: number | null;
}

type DeckAction =
  | { type: "loaded"; batch: DeckBatch }
  | { type: "load_failed" }
  | { type: "retry" }
  | { type: "decided"; tmdbId: number; decision: SwipeDecision }
  | { type: "decide_failed"; card: MovieSnapshot }
  | { type: "dismiss_toast" };

function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "loaded": {
      // TMDB's order can shift between pages: never show a card twice, nor
      // one already decided here (its save may not be in the database yet).
      const known = new Set([
        ...state.decided,
        ...state.queue.map((card) => card.tmdbId),
      ]);
      const fresh = action.batch.cards.filter((card) => {
        if (known.has(card.tmdbId)) return false;
        known.add(card.tmdbId);
        return true;
      });
      return {
        ...state,
        queue: [...state.queue, ...fresh],
        nextPage: action.batch.nextPage,
        loadFailed: false,
      };
    }
    case "load_failed":
      return { ...state, loadFailed: true };
    case "retry":
      return { ...state, loadFailed: false };
    case "decided":
      return {
        ...state,
        queue: state.queue.filter((card) => card.tmdbId !== action.tmdbId),
        decided: new Set(state.decided).add(action.tmdbId),
        lastDecision: action.decision,
        toast: null,
      };
    case "decide_failed": {
      // The card comes back on top, to be decided again.
      const decided = new Set(state.decided);
      decided.delete(action.card.tmdbId);
      const others = state.queue.filter(
        (card) => card.tmdbId !== action.card.tmdbId,
      );
      return {
        ...state,
        queue: [action.card, ...others],
        decided,
        toast: action.card.tmdbId,
      };
    }
    case "dismiss_toast":
      return { ...state, toast: null };
  }
}

function initDeck(initial: LoadMoreResult): DeckState {
  const empty: DeckState = {
    queue: [],
    nextPage: 1,
    loadFailed: false,
    decided: new Set(),
    lastDecision: "keep",
    toast: null,
  };
  return initial.ok
    ? deckReducer(empty, { type: "loaded", batch: initial.batch })
    : { ...empty, loadFailed: true };
}

/** Cards on screen; otherwise, why there are none. */
function deckView(state: DeckState) {
  if (state.queue.length > 0) return "cards";
  if (state.nextPage === null) return "end";
  return state.loadFailed ? "error" : "loading";
}

interface CardStackProps {
  queue: MovieSnapshot[];
  lastDecision: SwipeDecision;
  onDecide: (card: MovieSnapshot, decision: SwipeDecision) => void;
}

/**
 * The top two tickets and the buttons. While a card flies out, the buttons
 * wait, so a double tap cannot decide the next film before anyone has seen
 * it. That lock lives here: it resets with the stack whenever the deck runs
 * dry, since the leaving card then never reports the end of its exit.
 */
function CardStack({ queue, lastDecision, onDecide }: CardStackProps) {
  const reduce = useReducedMotion() ?? false;
  const [leaving, setLeaving] = useState(false);
  const [top] = queue;
  if (!top) return null;

  const decide = (card: MovieSnapshot, decision: SwipeDecision) => {
    setLeaving(true);
    onDecide(card, decision);
  };
  const choose = (decision: SwipeDecision) => {
    if (!leaving) decide(top, decision);
  };

  return (
    <>
      <section
        className={styles.deck}
        aria-label="Film à trier"
        aria-busy={leaving || undefined}
      >
        <AnimatePresence
          custom={lastDecision}
          initial={false}
          onExitComplete={() => setLeaving(false)}
        >
          {/* Behind first: later grid items paint on top. */}
          {queue
            .slice(0, 2)
            .reverse()
            .map((card) => (
              <SwipeCard
                key={card.tmdbId}
                movie={card}
                position={card === top ? "top" : "behind"}
                reduce={reduce}
                onDecide={(decision) => decide(card, decision)}
              />
            ))}
        </AnimatePresence>
      </section>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => choose("reject")}>
          ✕ BOF
        </Button>
        <Button variant="love" onClick={() => choose("keep")}>
          ON LE VEUT ♥
        </Button>
      </div>
    </>
  );
}

export function SwipeDeck({ initial, decide, loadMore }: SwipeDeckProps) {
  const [state, dispatch] = useReducer(deckReducer, initial, initDeck);
  const loading = useRef(false);

  // Keep a few cards ahead. A batch may bring no new card while pages remain
  // (all already decided): its new nextPage re-runs this effect.
  const { queue, nextPage, loadFailed, toast } = state;
  useEffect(() => {
    if (queue.length >= PRELOAD_BELOW || nextPage === null) return;
    if (loadFailed || loading.current) return;
    loading.current = true;
    loadMore(nextPage).then(
      (result) => {
        loading.current = false;
        dispatch(
          result.ok
            ? { type: "loaded", batch: result.batch }
            : { type: "load_failed" },
        );
      },
      () => {
        loading.current = false;
        dispatch({ type: "load_failed" });
      },
    );
  }, [queue.length, nextPage, loadFailed, loadMore]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(
      () => dispatch({ type: "dismiss_toast" }),
      TOAST_MS,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  const decideCard = (card: MovieSnapshot, decision: SwipeDecision) => {
    dispatch({ type: "decided", tmdbId: card.tmdbId, decision });
    // Optimistic: the card is gone already; it comes back if the save fails.
    decide(card.tmdbId, decision).catch(() =>
      dispatch({ type: "decide_failed", card }),
    );
  };

  const view = deckView(state);

  return (
    <main className={styles.screen}>
      {(view === "cards" || view === "loading") && (
        <h1 className={styles.kicker}>LES MIEUX NOTÉS</h1>
      )}

      {view === "cards" && (
        <CardStack
          queue={queue}
          lastDecision={state.lastDecision}
          onDecide={decideCard}
        />
      )}

      {view === "loading" && <LoadingTicket />}

      {view === "end" && (
        <>
          <h1 className={styles.logo}>
            <Lines lines={["VOUS AVEZ", "TOUT VU", "(OU PRESQUE)"]} />
          </h1>
          <p className={styles.small}>
            Plus aucun film des mieux notés à trier
          </p>
          <div className={styles.actions}>
            <ButtonLink href="/" variant="primary">
              ALLER TIRER
            </ButtonLink>
          </div>
        </>
      )}

      {view === "error" && (
        <>
          <h1 className={styles.logo}>
            <Lines lines={["TMDB NE", "RÉPOND PAS"]} />
          </h1>
          <p className={styles.small}>
            Impossible de charger les films pour l’instant
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: "retry" })}
            >
              RÉESSAYER
            </Button>
          </div>
        </>
      )}

      {toast !== null && (
        <p role="alert" className={styles.toast}>
          PAS RÉUSSI À ENREGISTRER, RÉESSAIE
        </p>
      )}
    </main>
  );
}

/** A blank ticket while the first (or next) cards load. */
function LoadingTicket() {
  return (
    <div className={styles.deck} aria-busy="true">
      <Ticket
        posterHeight={POSTER_HEIGHT}
        poster={<div className={styles.blank} aria-hidden="true" />}
      >
        <p className={styles.waiting}>ON CHERCHE DES FILMS…</p>
      </Ticket>
    </div>
  );
}

/** Shown while the first batch loads on the server. */
export function SwipeDeckFallback() {
  return (
    <main className={styles.screen}>
      <h1 className={styles.kicker}>LES MIEUX NOTÉS</h1>
      <LoadingTicket />
    </main>
  );
}
