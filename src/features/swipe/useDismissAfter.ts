import { type Dispatch, useEffect } from "react";
import type { DeckAction } from "./deckState";

type Dismiss = Extract<DeckAction, { type: "dismiss_toast" | "dismiss_undo" }>;

/** Dispatches `dismiss` `ms` after `shown` becomes non-null (or changes). */
export function useDismissAfter(
  shown: unknown,
  ms: number,
  dispatch: Dispatch<DeckAction>,
  dismiss: Dismiss["type"],
) {
  useEffect(() => {
    if (shown === null) return;
    const timer = setTimeout(() => dispatch({ type: dismiss }), ms);
    return () => clearTimeout(timer);
  }, [shown, ms, dispatch, dismiss]);
}
