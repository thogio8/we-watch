import { DECKS, DEFAULT_DECK, type DeckId } from "@/tmdb/decks";
import { ChipLink } from "@/ui/Chip";
import styles from "./SwipeDeck.module.css";

const deckHref = (id: DeckId) =>
  id === DEFAULT_DECK ? "/swipe" : `/swipe?deck=${id}`;

/** Themed decks as a scrolling row of chips; the deck lives in the URL. */
export function DeckChips({ deck }: { deck: DeckId | null }) {
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
