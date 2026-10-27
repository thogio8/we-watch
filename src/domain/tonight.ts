import type { MovieSnapshot, StreamingProvider } from "./movie";

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
  { id: "chills", label: "FRISSONNER", genreIds: [27, 53, 9648] },
  { id: "feel", label: "S’ÉMOUVOIR", genreIds: [18, 10749] },
  { id: "think", label: "RÉFLÉCHIR", genreIds: [99, 36, 10752, 878] },
  { id: "escape", label: "S’ÉVADER", genreIds: [12, 14, 16, 10751, 28] },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export interface TonightFilters {
  bedtime: Bedtime | null;
  moods: readonly MoodId[];
  providerIds: readonly number[];
}

export const NO_FILTERS: TonightFilters = {
  bedtime: null,
  moods: [],
  providerIds: [],
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

/** Platforms found in the list, most frequent first, then by name. */
export function tonightProviders(
  movies: readonly MovieSnapshot[],
): StreamingProvider[] {
  const counts = new Map<number, { provider: StreamingProvider; n: number }>();
  for (const provider of movies.flatMap((m) => m.providers)) {
    const entry = counts.get(provider.id);
    if (entry) entry.n += 1;
    else counts.set(provider.id, { provider, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.provider.name.localeCompare(b.provider.name))
    .map((entry) => entry.provider);
}

/**
 * Drops remembered platforms that no movie of the list has any more: their
 * chip is gone, so they could not be unselected.
 */
export function sanitizeFilters(
  filters: TonightFilters,
  movies: readonly MovieSnapshot[],
): TonightFilters {
  const known = new Set(tonightProviders(movies).map((p) => p.id));
  return {
    ...filters,
    providerIds: filters.providerIds.filter((id) => known.has(id)),
  };
}

export function isFiltering(filters: TonightFilters): boolean {
  return (
    filters.bedtime !== null ||
    filters.moods.length > 0 ||
    filters.providerIds.length > 0
  );
}

/** The movies that suit tonight; within a filter, choices are « or ». */
export function filterTonight<M extends MovieSnapshot>(
  movies: readonly M[],
  filters: TonightFilters,
  now: Date,
): M[] {
  const genres = new Set<number>(
    MOODS.filter((m) => filters.moods.includes(m.id)).flatMap(
      (m) => m.genreIds,
    ),
  );
  const providers = new Set(filters.providerIds);
  const { bedtime } = filters;
  return movies.filter(
    (movie) =>
      (bedtime === null || fitsBefore(movie.runtimeMinutes, now, bedtime)) &&
      (genres.size === 0 || movie.genreIds.some((id) => genres.has(id))) &&
      (providers.size === 0 ||
        movie.providers.some((p) => providers.has(p.id))),
  );
}
