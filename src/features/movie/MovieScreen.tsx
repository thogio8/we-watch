import Link from "next/link";
import type { Movie } from "@/domain/movie";
import type { MovieCredits } from "@/tmdb/credits";
import { Headline } from "@/ui/Headline";
import { Poster } from "@/ui/Poster";
import { Ticket } from "@/ui/Ticket";
import { TicketDetails } from "@/ui/TicketDetails";
import { MovieActions, type MovieActionsProps } from "./MovieActions";
import { MovieFacts } from "./MovieFacts";
import styles from "./MovieScreen.module.css";

interface MovieScreenProps {
  movie: Movie;
  credits: MovieCredits | null;
  actions: Pick<MovieActionsProps, "onWatched" | "onUnwatch" | "onRemove">;
}

const BackToList = () => (
  <Link href="/list" className={styles.back}>
    ← LA LISTE
  </Link>
);

/** A movie of our list in full (spec §14.2). */
export function MovieScreen({ movie, credits, actions }: MovieScreenProps) {
  return (
    <main className={styles.screen}>
      <BackToList />
      <Ticket
        className={styles.ticket}
        posterHeight={340}
        adaptive
        poster={
          <Poster path={movie.posterPath} title={movie.title} size="w500" />
        }
      >
        <TicketDetails movie={movie} platforms="all" fullOverview />
      </Ticket>
      <MovieFacts movie={movie} credits={credits} />
      <MovieActions tmdbId={movie.tmdbId} status={movie.status} {...actions} />
    </main>
  );
}

/** The address does not lead to a movie of our list. */
export function MovieNotFound() {
  return (
    <main className={styles.screen}>
      <BackToList />
      <Headline lines={["FILM", "INTROUVABLE"]} className={styles.dropped} />
      <p className={styles.note}>Il n’est pas (ou plus) dans notre liste</p>
    </main>
  );
}

/** While the page loads: the way back, already usable. */
export function MovieScreenFallback() {
  return (
    <main className={styles.screen} aria-busy="true">
      <BackToList />
    </main>
  );
}
