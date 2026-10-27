import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { Headline } from "@/ui/Headline";
import { Ticket } from "@/ui/Ticket";
import { POSTER_HEIGHT } from "./SwipeCard";
import styles from "./SwipeDeck.module.css";

/** A blank ticket while the first (or next) cards load. */
export function LoadingTicket() {
  return (
    <div className={styles.deck} aria-busy="true">
      <Ticket
        posterHeight={POSTER_HEIGHT}
        adaptive
        poster={<div className={styles.blank} aria-hidden="true" />}
      >
        <p className={styles.waiting}>ON CHERCHE DES FILMS…</p>
      </Ticket>
    </div>
  );
}

/** Every page of the theme has been read. */
export function DeckEnd() {
  return (
    <>
      <Headline
        as="h2"
        lines={["VOUS AVEZ", "TOUT VU", "(OU PRESQUE)"]}
        className={styles.dropped}
      />
      <p className={styles.small}>Plus aucun film de ce thème à trier</p>
      <div className={styles.actions}>
        <ButtonLink href="/" variant="primary">
          ALLER TIRER
        </ButtonLink>
      </div>
    </>
  );
}

/** TMDB failed: loading waits for « RÉESSAYER ». */
export function DeckError({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <Headline
        as="h2"
        lines={["TMDB NE", "RÉPOND PAS"]}
        className={styles.dropped}
      />
      <p className={styles.small}>
        Impossible de charger les films pour l’instant
      </p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onRetry}>
          RÉESSAYER
        </Button>
      </div>
    </>
  );
}
