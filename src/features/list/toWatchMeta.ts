import type { Movie } from "@/domain/movie";
import { formatRuntime } from "@/domain/time";
import { distinctPlatforms } from "@/domain/tonight";

/** « 2h05 · Netflix »; no platform reads « PAS EN STREAMING ». */
export function toWatchMeta(movie: Movie): string {
  const providers =
    movie.providers.length === 0
      ? ["PAS EN STREAMING"]
      : distinctPlatforms(movie.providers).map((p) => p.name);
  return [formatRuntime(movie.runtimeMinutes), ...providers]
    .filter((part) => part !== null)
    .join(" · ");
}
