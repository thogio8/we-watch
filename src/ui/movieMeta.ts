import type { MovieSnapshot } from "@/domain/movie";
import { formatRuntime } from "@/domain/time";

/** "8,5": one decimal, French comma. */
const formatRating = (vote: number) => vote.toFixed(1).replace(".", ",");

/** Ticket meta line: "2001 · 2h05 · ★8,5", skipping what TMDB does not know. */
export function movieMeta(movie: MovieSnapshot): string {
  return [
    movie.releaseYear,
    formatRuntime(movie.runtimeMinutes),
    `★${formatRating(movie.voteAverage)}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}
