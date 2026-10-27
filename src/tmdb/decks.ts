/**
 * Themed swipe decks (spec §11.4): each one is a TMDB /discover sorted by
 * rating, with its own vote floor so niche decks are not empty. Never a
 * streaming filter. Plain data, shared by the server and the deck chips.
 */
export const DECKS = [
  { id: "top", label: "LES MIEUX NOTÉS" },
  { id: "eighties", label: "ANNÉES 80" },
  { id: "nineties", label: "ANNÉES 90" },
  { id: "short", label: "MOINS DE 1H40" },
  { id: "animation", label: "ANIMATION" },
  { id: "french", label: "CINÉMA FRANÇAIS" },
  { id: "korean", label: "CINÉMA CORÉEN" },
] as const;

export type DeckId = (typeof DECKS)[number]["id"];

export const DEFAULT_DECK: DeckId = "top";

export type DeckParams = Record<string, string | number>;

const decade = (start: number): DeckParams => ({
  "primary_release_date.gte": `${start}-01-01`,
  "primary_release_date.lte": `${start + 9}-12-31`,
});

const PARAMS: Record<DeckId, DeckParams> = {
  top: { "vote_count.gte": 1000 },
  eighties: { ...decade(1980), "vote_count.gte": 500 },
  nineties: { ...decade(1990), "vote_count.gte": 500 },
  short: { "with_runtime.lte": 100, "vote_count.gte": 1000 },
  animation: { with_genres: "16", "vote_count.gte": 300 },
  french: { with_original_language: "fr", "vote_count.gte": 300 },
  korean: { with_original_language: "ko", "vote_count.gte": 200 },
};

export function deckLabel(id: DeckId): string {
  return DECKS.find((deck) => deck.id === id)?.label ?? "";
}

export function isDeckId(value: unknown): value is DeckId {
  return DECKS.some((deck) => deck.id === value);
}

/** TMDB /discover parameters of a deck, page and adult filter excluded. */
export function deckParams(id: DeckId): DeckParams {
  return { sort_by: "vote_average.desc", ...PARAMS[id] };
}
