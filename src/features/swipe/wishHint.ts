import type { DeckCard } from "./deck";
import { MATCH_HINT, MATCH_KEPT } from "./messages";

/**
 * The line under a card: a match kept from before I joined, or the match my
 * keep would make (every other member wants it); nothing otherwise. Never a
 * promise: the server alone says whether a swipe made the match.
 */
export function wishHint(card: DeckCard, groupSize: number): string | null {
  if (card.wish === undefined) return null;
  if (card.wish.matched) return MATCH_KEPT;
  return card.wish.others.length === groupSize - 1 ? MATCH_HINT : null;
}
