import { isMatch, type Movie } from "./movie";
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

/** Most first names spelled out before counting instead. */
export const MAX_NAMES = 3;

/**
 * « voulu par Léa, Hugo et Sam »; « voulu par vous deux » / « tout le groupe »
 * once a match holds every member's wish; « voulu par 9 sur 10 » past
 * MAX_NAMES names; null when nobody wanted it. N is never below K (a group
 * smaller than its wishes is read as being as big as them).
 */
export function wantedLine(
  names: readonly string[],
  context: { groupSize: number; matched: boolean },
): string | null {
  if (names.length === 0) return null;
  const { groupSize, matched } = context;
  if (matched && names.length === groupSize && groupSize >= 2) {
    return groupSize === 2 ? "voulu par vous deux" : "voulu par tout le groupe";
  }
  if (names.length > MAX_NAMES) {
    return `voulu par ${names.length} sur ${Math.max(groupSize, names.length)}`;
  }
  const head = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `voulu par ${head === "" ? last : `${head} et ${last}`}`;
}

/** What wantedLine needs to word a movie's wishes. */
export const wishContext = (m: Pick<Movie, "groupSize" | "matchedAt">) => ({
  groupSize: m.groupSize,
  matched: isMatch(m),
});

/** « match du groupe le 5 novembre 2026 »; null when not a match. */
export function matchLine(m: Pick<Movie, "matchedAt">): string | null {
  return m.matchedAt === null
    ? null
    : `match du groupe le ${formatLongDate(m.matchedAt)}`;
}

/** « vu le 18/10 · marqué par Hugo »; null when not watched. No marker known: a deleted account. */
export function watchedLine(
  m: Pick<Movie, "watchedAt" | "watchedBy">,
  format: (d: Date) => string,
): string | null {
  if (m.watchedAt === null) return null;
  return `vu le ${format(m.watchedAt)} · marqué par ${m.watchedBy ?? FORMER_MEMBER}`;
}

/** « d’ » before a vowel (h and y do not elide), « de » otherwise. */
function ofName(name: string): string {
  return /^[aeiouàâäéèêëîïôöùûüœæ]/iu.test(name) ? `d’${name}` : `de ${name}`;
}

/** « coup de cœur de Léa le 4 novembre 2026 »; null when not a favourite. */
export function favoriteLine(
  m: Pick<Movie, "favoriteAt" | "favoriteBy">,
): string | null {
  if (m.favoriteAt === null) return null;
  return `coup de cœur ${ofName(m.favoriteBy ?? FORMER_MEMBER)} le ${formatLongDate(m.favoriteAt)}`;
}
