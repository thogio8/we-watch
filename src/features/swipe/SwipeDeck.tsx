"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { ApplyResult } from "@/db/movies-repository";
import type { MovieSnapshot } from "@/domain/movie";
import { DECKS, DEFAULT_DECK, type DeckId, deckLabel } from "@/tmdb/decks";
import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { ChipLink } from "@/ui/Chip";
import { Lines } from "@/ui/Lines";
import { Ticket } from "@/ui/Ticket";
import type {
  decideSwipe,
  LoadMoreResult,
  loadMoreCards,
  SwipeDecision,
  undoSwipe,
} from "./actions";
import type { DeckBatch } from "./deck";
import { POSTER_HEIGHT, SwipeCard } from "./SwipeCard";
import styles from "./SwipeDeck.module.css";

interface SwipeDeckProps {
  deck: DeckId;
  initial: LoadMoreResult;
  decide: typeof decideSwipe;
  undo: typeof undoSwipe;
  loadMore: typeof loadMoreCards;
}

/** Below this many queued cards, the next page is fetched. */
const PRELOAD_BELOW = 3;
const TOAST_MS = 4000;
/** How long « ↺ ANNULER » stays offered after a swipe. */
const UNDO_MS = 5000;

type Toast = "save_failed" | "undo_failed";

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
  /** The swipe « ↺ ANNULER » would take back, null once dismissed. */
  undoable: { card: MovieSnapshot; decision: SwipeDecision } | null;
  /** Failure currently reported, null when no message. */
  toast: Toast | null;
}

type DeckAction =
  | { type: "loaded"; batch: DeckBatch }
  | { type: "load_failed" }
  | { type: "retry" }
  | { type: "decided"; card: MovieSnapshot; decision: SwipeDecision }
  | { type: "decide_failed"; card: MovieSnapshot }
  | { type: "undone" }
  | { type: "undo_failed"; tmdbId: number }
  | { type: "dismiss_undo" }
  | { type: "dismiss_toast" };

/** The card is back on top, undecided (failed save or « ↺ ANNULER »). */
function putBack(state: DeckState, card: MovieSnapshot): DeckState {
  const decided = new Set(state.decided);
  decided.delete(card.tmdbId);
  const others = state.queue.filter((c) => c.tmdbId !== card.tmdbId);
  return { ...state, queue: [card, ...others], decided };
}

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
        queue: state.queue.filter((card) => card.tmdbId !== action.card.tmdbId),
        decided: new Set(state.decided).add(action.card.tmdbId),
        lastDecision: action.decision,
        undoable: { card: action.card, decision: action.decision },
        toast: null,
      };
    case "decide_failed": {
      // The card comes back on top, to be decided again: nothing to undo.
      const undoable =
        state.undoable?.card.tmdbId === action.card.tmdbId
          ? null
          : state.undoable;
      return {
        ...putBack(state, action.card),
        undoable,
        toast: "save_failed",
      };
    }
    case "undone":
      if (state.undoable === null) return state;
      return { ...putBack(state, state.undoable.card), undoable: null };
    case "undo_failed":
      // The decision is still saved: the card leaves again, as decided.
      return {
        ...state,
        queue: state.queue.filter((card) => card.tmdbId !== action.tmdbId),
        decided: new Set(state.decided).add(action.tmdbId),
        toast: "undo_failed",
      };
    case "dismiss_undo":
      return { ...state, undoable: null };
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
    undoable: null,
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
 * it. The lock is the set of leaving ids, cleared when every exit completes.
 * A card whose save failed comes back mid-flight: AnimatePresence then never
 * reports the end of its exit, so a leaving id back in the queue no longer
 * locks. The lock also resets with the stack whenever the deck runs dry.
 */
function CardStack({ queue, lastDecision, onDecide }: CardStackProps) {
  const reduce = useReducedMotion() ?? false;
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [top] = queue;
  if (!top) return null;

  const queued = new Set(queue.map((card) => card.tmdbId));
  const locked = [...leavingIds].some((id) => !queued.has(id));

  const decide = (card: MovieSnapshot, decision: SwipeDecision) => {
    setLeavingIds((ids) => new Set(ids).add(card.tmdbId));
    onDecide(card, decision);
  };
  const choose = (decision: SwipeDecision) => {
    if (!locked) decide(top, decision);
  };

  return (
    <>
      <section
        className={styles.deck}
        aria-label="Film à trier"
        aria-busy={locked || undefined}
      >
        <AnimatePresence
          custom={lastDecision}
          initial={false}
          onExitComplete={() => setLeavingIds(new Set())}
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

const TOASTS: Record<Toast, string> = {
  save_failed: "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
  undo_failed: "PAS RÉUSSI À ANNULER",
};

const deckHref = (id: DeckId) =>
  id === DEFAULT_DECK ? "/swipe" : `/swipe?deck=${id}`;

/** Themed decks as a scrolling row of chips; the deck lives in the URL. */
function DeckChips({ deck }: { deck: DeckId | null }) {
  return (
    <nav className={styles.decks} aria-label="Thèmes">
      {DECKS.map(({ id, label }) => (
        <ChipLink key={id} href={deckHref(id)} current={id === deck}>
          {label}
        </ChipLink>
      ))}
    </nav>
  );
}

export function SwipeDeck({
  deck,
  initial,
  decide,
  undo,
  loadMore,
}: SwipeDeckProps) {
  const [state, dispatch] = useReducer(deckReducer, initial, initDeck);
  const loading = useRef(false);
  /**
   * Last save or undo of each movie, so they reach the server in the order
   * they were made: an undo waits for its save (and only undoes a swipe that
   * applied), a new decision waits for the undo.
   */
  const ops = useRef(new Map<number, Promise<ApplyResult>>());
  const chain = (
    tmdbId: number,
    next: (previous: ApplyResult) => Promise<ApplyResult>,
  ) => {
    const previous = ops.current.get(tmdbId) ?? Promise.resolve("noop");
    // A failed operation was reported already: the next one starts afresh.
    const op = previous.catch((): ApplyResult => "noop").then(next);
    ops.current.set(tmdbId, op);
    return op;
  };

  // Keep a few cards ahead. A batch may bring no new card while pages remain
  // (all already decided): its new nextPage re-runs this effect.
  const { queue, nextPage, loadFailed, toast, undoable } = state;
  useEffect(() => {
    if (queue.length >= PRELOAD_BELOW || nextPage === null) return;
    if (loadFailed || loading.current) return;
    loading.current = true;
    loadMore(deck, nextPage).then(
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
  }, [queue.length, nextPage, loadFailed, loadMore, deck]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(
      () => dispatch({ type: "dismiss_toast" }),
      TOAST_MS,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (undoable === null) return;
    const timer = setTimeout(() => dispatch({ type: "dismiss_undo" }), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undoable]);

  const decideCard = (card: MovieSnapshot, decision: SwipeDecision) => {
    dispatch({ type: "decided", card, decision });
    // Optimistic: the card is gone already; it comes back if the save fails.
    const op = chain(card.tmdbId, () => decide(card.tmdbId, decision));
    op.catch(() => {
      // An undo or a new decision came after: this card's fate is theirs.
      if (ops.current.get(card.tmdbId) === op) {
        dispatch({ type: "decide_failed", card });
      }
    });
  };

  const undoLast = () => {
    if (undoable === null) return;
    const { card, decision } = undoable;
    dispatch({ type: "undone" });
    // A swipe that did not apply (decided on another device) is not ours to
    // erase: the card simply comes back.
    chain(card.tmdbId, (saved) =>
      saved === "applied"
        ? undo(card.tmdbId, decision)
        : Promise.resolve(saved),
    ).catch(() => dispatch({ type: "undo_failed", tmdbId: card.tmdbId }));
  };

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

      {view === "end" && (
        <>
          <h2 className={styles.logo}>
            <Lines lines={["VOUS AVEZ", "TOUT VU", "(OU PRESQUE)"]} />
          </h2>
          <p className={styles.small}>Plus aucun film de ce thème à trier</p>
          <div className={styles.actions}>
            <ButtonLink href="/" variant="primary">
              ALLER TIRER
            </ButtonLink>
          </div>
        </>
      )}

      {view === "error" && (
        <>
          <h2 className={styles.logo}>
            <Lines lines={["TMDB NE", "RÉPOND PAS"]} />
          </h2>
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

      {toast !== null ? (
        <p role="alert" className={styles.toast}>
          {TOASTS[toast]}
        </p>
      ) : (
        undoable !== null && (
          <div className={styles.undo} role="status">
            <span className={styles.undoText}>
              {undoable.decision === "keep" ? "♥ " : "✕ "}
              {undoable.card.title}
            </span>
            <button
              type="button"
              className={styles.undoButton}
              onClick={undoLast}
            >
              ↺ ANNULER
            </button>
          </div>
        )
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
