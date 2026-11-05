import {
  isFavorite,
  isMatch,
  type Movie,
  type MovieSnapshot,
  type StreamingProvider,
} from "./movie";

/**
 * « Ce soir » filters of the draw (spec §11.1). Every filter is optional and
 * the list stays the truth: no filter means the whole « à voir » list.
 */

/** Minutes after the evening's midnight; past 24 h means the next day. */
export type Bedtime = number;

export const BEDTIMES: readonly { minutes: Bedtime; label: string }[] = [
  { minutes: 22 * 60 + 30, label: "22H30" },
  { minutes: 23 * 60, label: "23H" },
  { minutes: 23 * 60 + 30, label: "23H30" },
  { minutes: 24 * 60, label: "MINUIT" },
  { minutes: 25 * 60, label: "1H" },
];

export const MOODS = [
  { id: "laugh", label: "RIRE", genreIds: [35] },
  { id: "chills", label: "FRISSONNER", genreIds: [27, 53, 9648, 80] },
  { id: "feel", label: "S’ÉMOUVOIR", genreIds: [18, 10749] },
  { id: "think", label: "RÉFLÉCHIR", genreIds: [99, 36, 10752, 878] },
  { id: "escape", label: "S’ÉVADER", genreIds: [12, 14, 16, 10751, 28, 37] },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

/** Which part of the list the draw picks from; never stored. */
export type TonightPool = "all" | "favorites" | "matches";

export interface TonightFilters {
  bedtime: Bedtime | null;
  moods: readonly MoodId[];
  /** Platform keys (see platformKey); empty means every platform. */
  platforms: readonly string[];
  /** « ON TIRE PARMI »: per evening, never stored on the device. */
  pool: TonightPool;
}

/** A list movie as the draw sees it: its snapshot and its marks. */
export type TonightMovie = MovieSnapshot &
  Pick<Movie, "favoriteAt" | "matchedAt">;

export const NO_FILTERS: TonightFilters = {
  bedtime: null,
  moods: [],
  platforms: [],
  pool: "all",
};

const HOUR_MS = 3_600_000;
const DAY_MINUTES = 24 * 60;

/**
 * The bedtime occurrence that matters at `now`: within the last 6 hours (it
 * is already too late) or the next 18 (tonight, seen from the morning).
 */
export function bedtimeDeadline(now: Date, bedtime: Bedtime): Date {
  const minutes = bedtime % DAY_MINUTES;
  const deadline = new Date(now);
  deadline.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const diff = deadline.getTime() - now.getTime();
  if (diff > 18 * HOUR_MS) deadline.setDate(deadline.getDate() - 1);
  else if (diff <= -6 * HOUR_MS) deadline.setDate(deadline.getDate() + 1);
  return deadline;
}

/** Started now, the movie ends by bedtime. Unknown runtime: no promise. */
export function fitsBefore(
  runtimeMinutes: number | null,
  now: Date,
  bedtime: Bedtime,
): boolean {
  if (!runtimeMinutes) return false;
  const end = now.getTime() + runtimeMinutes * 60_000;
  return end <= bedtimeDeadline(now, bedtime).getTime();
}

/**
 * TMDB lists each offer apart (« Netflix Standard with Ads », « HBO Max
 * Amazon Channel », « Paramount Plus Premium »): one key per platform, so the
 * couple picks « Netflix », not one of its plans.
 */
const OFFER_SUFFIX =
  / (?:standard with ads|with ads|amazon channel|apple tv channel|premium)$/;

export function platformKey(providerName: string): string {
  let key = providerName
    .toLowerCase()
    .trim()
    .replace(/ plus\b/g, "+");
  // « Paramount Plus Premium Amazon Channel » sheds every offer suffix.
  while (OFFER_SUFFIX.test(key)) key = key.replace(OFFER_SUFFIX, "");
  return key;
}

export interface Platform {
  key: string;
  /** Shortest offer name, e.g. « Netflix » rather than its plan with ads. */
  name: string;
}

/** Platforms found in the list, most frequent first, then by name. */
export function tonightPlatforms(movies: readonly MovieSnapshot[]): Platform[] {
  const found = new Map<string, Platform & { movies: number }>();
  for (const movie of movies) {
    const keys = new Set<string>();
    for (const { name } of movie.providers) {
      const key = platformKey(name);
      const entry = found.get(key) ?? { key, name, movies: 0 };
      if (name.length < entry.name.length) entry.name = name;
      if (!keys.has(key)) entry.movies += 1;
      keys.add(key);
      found.set(key, entry);
    }
  }
  return [...found.values()]
    .sort((a, b) => b.movies - a.movies || a.name.localeCompare(b.name))
    .map(({ key, name }) => ({ key, name }));
}

/** One provider per platform, in TMDB's order (ticket tags). */
export function distinctPlatforms(
  providers: readonly StreamingProvider[],
): StreamingProvider[] {
  const seen = new Set<string>();
  return providers.filter(({ name }) => {
    const key = platformKey(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Whether a movie belongs to each pool of « ON TIRE PARMI ». */
const IN_POOL: Record<TonightPool, (movie: TonightMovie) => boolean> = {
  all: () => true,
  favorites: isFavorite,
  matches: isMatch,
};

/**
 * Drops remembered platforms that no movie of the list has any more (their
 * chip is gone, so they could not be unselected) and the pool once the list
 * holds nothing of it (no favourite, no match): back to the whole list.
 */
export function sanitizeFilters(
  filters: TonightFilters,
  movies: readonly TonightMovie[],
): TonightFilters {
  const known = new Set(tonightPlatforms(movies).map((p) => p.key));
  return {
    ...filters,
    platforms: filters.platforms.filter((key) => known.has(key)),
    pool: movies.some(IN_POOL[filters.pool]) ? filters.pool : "all",
  };
}

export function isFiltering(filters: TonightFilters): boolean {
  return (
    filters.bedtime !== null ||
    filters.moods.length > 0 ||
    filters.platforms.length > 0 ||
    filters.pool !== "all"
  );
}

/** The movies that suit tonight; within a filter, choices are « or ». */
export function filterTonight<M extends TonightMovie>(
  movies: readonly M[],
  filters: TonightFilters,
  now: Date,
): M[] {
  const genres = new Set<number>(
    MOODS.filter((m) => filters.moods.includes(m.id)).flatMap(
      (m) => m.genreIds,
    ),
  );
  const platforms = new Set(filters.platforms);
  const { bedtime } = filters;
  return movies.filter(
    (movie) =>
      IN_POOL[filters.pool](movie) &&
      (bedtime === null || fitsBefore(movie.runtimeMinutes, now, bedtime)) &&
      (genres.size === 0 || movie.genreIds.some((id) => genres.has(id))) &&
      (platforms.size === 0 ||
        movie.providers.some((p) => platforms.has(platformKey(p.name)))),
  );
}
