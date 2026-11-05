import {
  BEDTIMES,
  MOODS,
  type Platform,
  type TonightFilters,
  type TonightPool,
} from "@/domain/tonight";

/** Adds the item if missing, removes it if present. */
export const toggle = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

const POOL_SUMMARY: Record<Exclude<TonightPool, "all">, string> = {
  favorites: "COUPS DE CŒUR",
  matches: "MATCHS",
};

/** « COUPS DE CŒUR · AVANT MINUIT · RIRE · NETFLIX », or « AUCUN FILTRE ». */
export function filtersSummary(
  filters: TonightFilters,
  platforms: readonly Platform[],
): string {
  const bedtime = BEDTIMES.find((b) => b.minutes === filters.bedtime);
  const pool = filters.pool === "all" ? null : POOL_SUMMARY[filters.pool];
  const parts = [
    ...(pool ? [pool] : []),
    ...(bedtime ? [`AVANT ${bedtime.label}`] : []),
    ...MOODS.filter((m) => filters.moods.includes(m.id)).map((m) => m.label),
    ...platforms
      .filter((p) => filters.platforms.includes(p.key))
      .map((p) => p.name.toUpperCase()),
  ];
  return parts.length > 0 ? parts.join(" · ") : "AUCUN FILTRE";
}
