import { genreNames } from "@/domain/genres";
import type { Movie } from "@/domain/movie";
import { formatLongDate } from "@/domain/time";
import type { MovieCredits } from "@/tmdb/credits";
import styles from "./MovieScreen.module.css";

/** « Ajouté le 3 octobre 2026 · Vu le 27 octobre 2026 ». */
function ourHistory(movie: Movie): string {
  const added = `Ajouté le ${formatLongDate(movie.decidedAt)}`;
  return movie.watchedAt
    ? `${added} · Vu le ${formatLongDate(movie.watchedAt)}`
    : added;
}

const listed = (names: readonly string[] | undefined, separator: string) =>
  names && names.length > 0 ? names.join(separator) : null;

/** The movie's details beyond the ticket; an unknown one is left out. */
export function MovieFacts({
  movie,
  credits,
}: {
  movie: Movie;
  credits: MovieCredits | null;
}) {
  const facts: [label: string, value: string | null][] = [
    ["GENRES", listed(genreNames(movie.genreIds), " · ")],
    ["RÉALISATION", listed(credits?.directors, ", ")],
    ["AVEC", listed(credits?.cast, ", ")],
    ["CHEZ NOUS", ourHistory(movie)],
  ];
  return (
    <dl className={styles.facts}>
      {facts.map(
        ([label, value]) =>
          value && (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ),
      )}
    </dl>
  );
}
