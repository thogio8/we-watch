import { isFavorite, type Movie } from "@/domain/movie";

export interface ListSection {
  /** React key and id suffix. */
  key: "favorites" | "rest" | "all";
  /** « ♥ COUPS DE CŒUR · 2 », « LE RESTE · 3 »; null: no heading (no favourite). */
  title: string | null;
  movies: Movie[];
}

/**
 * The « à voir » tab: favourites first under their heading, then the rest.
 * Without a favourite, the 2.0 list as received, with no heading.
 */
export function toWatchSections(movies: readonly Movie[]): ListSection[] {
  if (movies.length === 0) return [];
  const favorites = movies.filter(isFavorite);
  if (favorites.length === 0) {
    return [{ key: "all", title: null, movies: [...movies] }];
  }
  const rest = movies.filter((movie) => !isFavorite(movie));
  const sections: ListSection[] = [
    {
      key: "favorites",
      title: `♥ COUPS DE CŒUR · ${favorites.length}`,
      movies: favorites,
    },
  ];
  if (rest.length > 0) {
    sections.push({
      key: "rest",
      title: `LE RESTE · ${rest.length}`,
      movies: rest,
    });
  }
  return sections;
}
