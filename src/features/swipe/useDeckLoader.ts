import { leaveIfRefused } from "@/access/refusals";
import { type Dispatch, useEffect, useRef } from "react";
import type { DeckId } from "@/tmdb/decks";
import type { LoadCards } from "./actions";
import type { DeckAction, DeckState } from "./deckState";

/** Below this many queued cards, the next page is fetched. */
const PRELOAD_BELOW = 3;

/**
 * Keeps a few cards ahead. A batch may bring no new card while pages remain
 * (all already decided): its new nextPage re-runs the effect.
 */
export function useDeckLoader(
  deck: DeckId,
  { queue, nextPage, loadFailed }: DeckState,
  dispatch: Dispatch<DeckAction>,
  loadMore: LoadCards,
) {
  const loading = useRef(false);
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
      (error: unknown) => {
        leaveIfRefused(error);
        loading.current = false;
        dispatch({ type: "load_failed" });
      },
    );
  }, [queue.length, nextPage, loadFailed, loadMore, deck, dispatch]);
}
