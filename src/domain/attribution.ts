import type { Movie } from "./movie";
import { formatLongDate } from "./time";

/** Stands for an author whose account was deleted (name resolved to null). */
export const FORMER_MEMBER = "un ancien membre";

/** « ajouté par Léa le 12 octobre » (no author: copied rows, deleted accounts). */
export function addedLine(
  m: Pick<Movie, "addedBy" | "legacy" | "decidedAt">,
): string {
  const date = formatLongDate(m.decidedAt);
  if (m.addedBy !== null) return `ajouté par ${m.addedBy} le ${date}`;
  return m.legacy
    ? `ajouté le ${date}`
    : `ajouté par ${FORMER_MEMBER} le ${date}`;
}

/** « voulu par Léa, Hugo et Sam »; null when nobody wanted it. */
export function wantedLine(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const head = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `voulu par ${head === "" ? last : `${head} et ${last}`}`;
}

/** « vu le 18/10 · marqué par Hugo »; null when not watched. */
export function watchedLine(
  m: Pick<Movie, "watchedAt" | "watchedBy" | "legacy">,
  format: (d: Date) => string,
): string | null {
  if (m.watchedAt === null) return null;
  const seen = `vu le ${format(m.watchedAt)}`;
  if (m.watchedBy !== null) return `${seen} · marqué par ${m.watchedBy}`;
  return m.legacy ? seen : `${seen} · marqué par ${FORMER_MEMBER}`;
}
