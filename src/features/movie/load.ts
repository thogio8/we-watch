import "server-only";
import type { Movie } from "@/domain/movie";
import { getGroupList, getTmdbClient } from "@/server/container";
import { isMemberOf } from "@/server/groups";
import { isPositiveInt } from "@/server/validate";
import { TmdbError } from "@/tmdb/client";
import { getMovieCredits, type MovieCredits } from "@/tmdb/credits";

export interface MoviePage {
  movie: Movie;
  /** Null when TMDB does not answer: the page shows without it. */
  credits: MovieCredits | null;
}

async function creditsOrNull(tmdbId: number): Promise<MovieCredits | null> {
  try {
    return await getMovieCredits(getTmdbClient(), tmdbId);
  } catch (error) {
    if (error instanceof TmdbError) return null;
    throw error;
  }
}

/**
 * The page of a movie of the group's list, from its URL segment; null: not
 * found, also for a group I am not a member of.
 */
export async function loadMoviePage(
  groupId: string,
  segment: string,
): Promise<MoviePage | null> {
  const tmdbId = Number(segment);
  if (!isPositiveInt(tmdbId) || !(await isMemberOf(groupId))) return null;
  const [movie, credits] = await Promise.all([
    getGroupList().findInList(groupId, tmdbId),
    creditsOrNull(tmdbId),
  ]);
  return movie ? { movie, credits } : null;
}
