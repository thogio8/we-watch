import type { DrawSessionState } from "@/domain/draw-session";
import type { ListCounts, Movie } from "@/domain/movie";
import { isFiltering, type TonightFilters } from "@/domain/tonight";

export type View =
  | { phase: "home" }
  | { phase: "result"; movie: Movie }
  | { phase: "exhausted" }
  | { phase: "empty" };

/**
 * What to show for the session, given the current list and the movies that
 * suit tonight's filters. The list may have changed since the draw (other tab,
 * other device): a vanished movie or newly eligible ones send the screen back
 * home, the pile being kept; an exhausted pile whose list was emptied shows
 * the empty-list screen.
 */
export function resolveView(
  state: DrawSessionState,
  toWatch: Movie[],
  eligible: Movie[],
): View {
  switch (state.phase) {
    case "result": {
      const movie = toWatch.find((m) => m.tmdbId === state.currentId);
      return movie ? { phase: "result", movie } : { phase: "home" };
    }
    case "exhausted":
      if (toWatch.length === 0) return { phase: "empty" };
      return eligible.length > 0 &&
        eligible.every((m) => state.pile.includes(m.tmdbId))
        ? { phase: "exhausted" }
        : { phase: "home" };
    case "empty":
      return toWatch.length === 0 ? { phase: "empty" } : { phase: "home" };
    case "home":
      return { phase: "home" };
  }
}

/** Animation key of a view: each drawn movie is a screen of its own. */
export const viewKey = (view: View): string =>
  view.phase === "result" ? `result-${view.movie.tmdbId}` : view.phase;

export const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n > 1 ? pluralForm : singular}`;

export function exhaustedText(count: number, filtering: boolean): string {
  if (filtering) {
    return count === 1
      ? "Le seul film qui collait est passé à la trappe"
      : `Les ${count} films qui collaient sont passés à la trappe`;
  }
  return count === 1
    ? "Le seul film de la liste est passé à la trappe"
    : `Les ${count} films sont passés à la trappe`;
}

export interface DrawButton {
  lines: string[];
  tone: "yellow" | "pink";
}

/**
 * The big button: pink for the favourites pool, yellow for the matches pool,
 * « PARMI n » as soon as anything else narrows the list.
 */
export function drawButton(
  filters: TonightFilters,
  eligibleCount: number,
): DrawButton {
  const tone = filters.pool === "favorites" ? "pink" : "yellow";
  const others = isFiltering({ ...filters, pool: "all" });
  if (filters.pool === "favorites" && !others) {
    return { lines: ["TIRER", "UN COUP", "DE CŒUR"], tone };
  }
  if (filters.pool === "matches" && !others) {
    return { lines: ["TIRER", "UN MATCH"], tone };
  }
  if (isFiltering(filters)) {
    return { lines: ["TIRER", `PARMI ${eligibleCount}`], tone };
  }
  return { lines: ["TIRER", "UN", "FILM"], tone };
}

/**
 * « 5 films à regarder · dont 2 ♥ · dont 1 match · 1 vu »: the favourites and
 * the matches only if any.
 */
export function homeCounts({
  toWatch,
  watched,
  favorites,
  matches,
}: ListCounts): string {
  const parts = [
    `${plural(toWatch, "film", "films")} à regarder`,
    ...(favorites > 0 ? [`dont ${favorites} ♥`] : []),
    ...(matches > 0 ? [`dont ${plural(matches, "match", "matchs")}`] : []),
    plural(watched, "vu", "vus"),
  ];
  return parts.join(" · ");
}
