import "server-only";
import type { TmdbClient } from "./client";
import { type TmdbCredits, tmdbCreditsSchema } from "./schemas";

const MAIN_CAST = 4;
const CREDITS_REVALIDATE_SECONDS = 86400;

export interface MovieCredits {
  directors: string[];
  /** Top-billed actors, in billing order. */
  cast: string[];
}

export function toCredits({ cast, crew }: TmdbCredits): MovieCredits {
  return {
    directors: crew.filter((c) => c.job === "Director").map((c) => c.name),
    cast: [...cast]
      .sort((a, b) => a.order - b.order)
      .slice(0, MAIN_CAST)
      .map((c) => c.name),
  };
}

/** Who made the movie and who is in it (24 h cache: it hardly changes). */
export async function getMovieCredits(
  client: TmdbClient,
  tmdbId: number,
): Promise<MovieCredits> {
  const data = await client.get(
    `/movie/${tmdbId}/credits`,
    {},
    tmdbCreditsSchema,
    { revalidateSeconds: CREDITS_REVALIDATE_SECONDS },
  );
  return toCredits(data);
}
