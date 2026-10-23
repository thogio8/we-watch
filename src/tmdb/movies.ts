import "server-only";
import type { MovieSnapshot } from "@/domain/movie";
import type { TmdbClient } from "./client";
import {
  type TmdbMovieDetails,
  tmdbDiscoverSchema,
  tmdbMovieDetailsSchema,
  tmdbSearchSchema,
} from "./schemas";

export { posterUrl } from "./images";

const MAX_TMDB_PAGES = 500;
const MAX_SEARCH_RESULTS = 8;
const DETAILS_REVALIDATE_SECONDS = 86400;
const DISCOVER_REVALIDATE_SECONDS = 3600;

export interface DiscoverPage {
  ids: number[];
  totalPages: number;
}

export function toSnapshot(details: TmdbMovieDetails): MovieSnapshot {
  const year = /^(\d{4})/.exec(details.release_date ?? "")?.[1];
  const flatrate = details["watch/providers"]?.results.FR?.flatrate ?? [];
  return {
    tmdbId: details.id,
    title: details.title,
    releaseYear: year === undefined ? null : Number(year),
    runtimeMinutes: details.runtime ? details.runtime : null,
    overview: details.overview ?? "",
    posterPath: details.poster_path ?? null,
    voteAverage: details.vote_average,
    providers: [...flatrate]
      .sort((a, b) => a.display_priority - b.display_priority)
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path,
      })),
  };
}

export async function discoverTopRated(
  client: TmdbClient,
  page: number,
): Promise<DiscoverPage> {
  const data = await client.get(
    "/discover/movie",
    {
      sort_by: "vote_average.desc",
      "vote_count.gte": 1000,
      include_adult: false,
      page,
    },
    tmdbDiscoverSchema,
    { revalidateSeconds: DISCOVER_REVALIDATE_SECONDS },
  );
  return {
    ids: data.results.map((r) => r.id),
    totalPages: Math.min(data.total_pages, MAX_TMDB_PAGES),
  };
}

export async function getMovieSnapshot(
  client: TmdbClient,
  tmdbId: number,
): Promise<MovieSnapshot> {
  const details = await client.get(
    `/movie/${tmdbId}`,
    { append_to_response: "watch/providers" },
    tmdbMovieDetailsSchema,
    { revalidateSeconds: DETAILS_REVALIDATE_SECONDS },
  );
  return toSnapshot(details);
}

export async function searchMovies(
  client: TmdbClient,
  query: string,
): Promise<MovieSnapshot[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  const data = await client.get(
    "/search/movie",
    { query: trimmed, include_adult: false },
    tmdbSearchSchema,
  );
  return Promise.all(
    data.results
      .slice(0, MAX_SEARCH_RESULTS)
      .map((r) => getMovieSnapshot(client, r.id)),
  );
}
