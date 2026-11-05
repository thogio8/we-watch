import {
  addedLine,
  favoriteLine,
  matchLine,
  wantedLine,
  watchedLine,
} from "@/domain/attribution";
import { genreNames } from "@/domain/genres";
import { type Movie, wishContext } from "@/domain/movie";
import { formatLongDate } from "@/domain/time";
import type { MovieCredits } from "@/tmdb/credits";
import styles from "./MovieScreen.module.css";

/**
 * Who added it and when, who wanted it, whose favourite it is since when, who
 * marked it watched and when.
 */
const ourHistory = (movie: Movie) => [
  addedLine(movie),
  wantedLine(movie.wantedBy, wishContext(movie)),
  matchLine(movie),
  // Only a film to watch is a favourite, even if a row kept its columns.
  movie.status === "to_watch" ? favoriteLine(movie) : null,
  watchedLine(movie, formatLongDate),
];

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
  // Each fact is one or more lines, shown one under the other.
  const facts: [label: string, lines: (string | null)[]][] = [
    ["GENRES", [listed(genreNames(movie.genreIds), " · ")]],
    ["RÉALISATION", [listed(credits?.directors, ", ")]],
    ["AVEC", [listed(credits?.cast, ", ")]],
    ["CHEZ NOUS", ourHistory(movie)],
  ];
  return (
    <dl className={styles.facts}>
      {facts.map(([label, lines]) => {
        const shown = lines.filter((line) => line !== null);
        return (
          shown.length > 0 && (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>
                {shown.map((line) => (
                  <span key={line} className={styles.line}>
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          )
        );
      })}
    </dl>
  );
}
