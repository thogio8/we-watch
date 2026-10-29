import { connection } from "next/server";
import { Suspense } from "react";
import { FirstGroup } from "@/features/groups/FirstGroup";
import { SwipeDeck, SwipeDeckFallback } from "@/features/swipe/SwipeDeck";
import {
  decideSwipe,
  loadMoreCards,
  undoSwipe,
} from "@/features/swipe/actions";
import { getActiveGroup } from "@/server/groups";
import { DEFAULT_DECK, type DeckId, isDeckId } from "@/tmdb/decks";

/** First batch on every request (the group's list and my BOF live in the database). */
async function SwipeData({ deck }: { deck: DeckId }) {
  await connection();
  const active = await getActiveGroup();
  if (!active?.group) return <FirstGroup />;
  const groupId = active.group.id;
  // Same path as the client's later loads: a TMDB error gives { ok: false }.
  const initial = await loadMoreCards(groupId, deck, 1);
  return (
    <SwipeDeck
      deck={deck}
      initial={initial}
      decide={decideSwipe.bind(null, groupId)}
      undo={undoSwipe.bind(null, groupId)}
      loadMore={loadMoreCards.bind(null, groupId)}
    />
  );
}

/** The theme comes from `?deck=`, only known at request time. */
async function SwipeTheme({
  searchParams,
}: {
  searchParams: PageProps<"/swipe">["searchParams"];
}) {
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

export default function SwipePage({ searchParams }: PageProps<"/swipe">) {
  return (
    <Suspense fallback={<SwipeDeckFallback deck={null} />}>
      <SwipeTheme searchParams={searchParams} />
    </Suspense>
  );
}
