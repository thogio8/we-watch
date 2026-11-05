import { leaveIfRefused } from "@/access/refusals";
import { type Dispatch, useRef } from "react";
import type { ApplyResult } from "@/domain/transitions";
import type { SendDecision, SendUndo, SwipeDecision } from "./actions";
import type { DeckCard } from "./deck";
import type { DeckAction, DeckState } from "./deckState";

/**
 * Sends swipes and undos to the server, optimistically. The last save or
 * undo of each movie is kept, so they reach the server in the order they
 * were made: an undo waits for its save (and only undoes a swipe that
 * applied), a new decision waits for the undo. Only the server says a swipe
 * made a match, and only the card's latest operation may open its moment.
 */
export function useSwipeSync(
  undoable: DeckState["undoable"],
  dispatch: Dispatch<DeckAction>,
  decide: SendDecision,
  undo: SendUndo,
) {
  const ops = useRef(new Map<number, Promise<ApplyResult>>());
  const chain = (
    tmdbId: number,
    next: (previous: ApplyResult) => Promise<ApplyResult>,
  ) => {
    const previous = ops.current.get(tmdbId) ?? Promise.resolve("noop");
    // A failed operation was reported already: the next one starts afresh.
    const op = previous.catch((): ApplyResult => "noop").then(next);
    ops.current.set(tmdbId, op);
    op.catch(leaveIfRefused);
    return op;
  };

  const decideCard = (card: DeckCard, decision: SwipeDecision) => {
    dispatch({ type: "decided", card, decision });
    // Optimistic: the card is gone already; it comes back if the save fails.
    let matched = false;
    const op = chain(card.tmdbId, async () => {
      const outcome = await decide(card.tmdbId, decision);
      matched = outcome.matched;
      return outcome.result;
    });
    // An undo or a new decision came after: this card's fate is theirs.
    const latest = () => ops.current.get(card.tmdbId) === op;
    op.then(
      () => {
        if (matched && latest()) dispatch({ type: "matched", card });
      },
      () => {
        if (latest()) dispatch({ type: "decide_failed", card });
      },
    );
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

  return { decideCard, undoLast };
}
