import { connection } from "next/server";
import { Suspense } from "react";
import { SwipeDeck, SwipeDeckFallback } from "@/features/swipe/SwipeDeck";
import {
  decideSwipe,
  loadMoreCards,
  undoSwipe,
} from "@/features/swipe/actions";
import { DEFAULT_DECK, type DeckId, isDeckId } from "@/tmdb/decks";

/** First batch on every request (decided movies live in the database). */
async function SwipeData({ deck }: { deck: DeckId }) {
  await connection();
  // Same path as the client's later loads: a TMDB error gives { ok: false }.
  const initial = await loadMoreCards(deck, 1);
  return (
    <SwipeDeck
      deck={deck}
      initial={initial}
      decide={decideSwipe}
      undo={undoSwipe}
      loadMore={loadMoreCards}
    />
  );
}

export default async function SwipePage({ searchParams }: PageProps<"/swipe">) {
  const { deck: param } = await searchParams;
  // An unknown or repeated ?deck= falls back to the default deck.
  const deck = isDeckId(param) ? param : DEFAULT_DECK;
  return (
    // Keyed by deck: switching theme starts a fresh deck and fallback.
    <Suspense key={deck} fallback={<SwipeDeckFallback deck={deck} />}>
      <SwipeData deck={deck} />
    </Suspense>
  );
}
