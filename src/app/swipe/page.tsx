import { connection } from "next/server";
import { Suspense } from "react";
import { SwipeDeck, SwipeDeckFallback } from "@/features/swipe/SwipeDeck";
import { decideSwipe, loadMoreCards } from "@/features/swipe/actions";

/** First batch on every request (decided movies live in the database). */
async function SwipeData() {
  await connection();
  // Same path as the client's later loads: a TMDB error gives { ok: false }.
  const initial = await loadMoreCards(1);
  return (
    <SwipeDeck
      initial={initial}
      decide={decideSwipe}
      loadMore={loadMoreCards}
    />
  );
}

export default function SwipePage() {
  return (
    <Suspense fallback={<SwipeDeckFallback />}>
      <SwipeData />
    </Suspense>
  );
}
