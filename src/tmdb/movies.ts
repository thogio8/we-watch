import "server-only";
import type { MovieSnapshot } from "@/domain/movie";
import type { TmdbClient } from "./client";
import { type DeckId, deckParams } from "./decks";
import {
  type TmdbMovieDetails,
  tmdbDiscoverSchema,
  tmdbMovieDetailsSchema,
  tmdbSearchSchema,
} from "./schemas";

const MAX_TMDB_PAGES = 500;
const MAX_SEARCH_RESULTS = 8;
const DETAILS_REVALIDATE_SECONDS = 86400;
const DISCOVER_REVALIDATE_SECONDS = 3600;

export interface DiscoverPage {
  ids: number[];
  totalPages: number;
}

type TmdbVideo = NonNullable<TmdbMovieDetails["videos"]>["results"][number];

/** A YouTube trailer: French first, then official, then TMDB's order. */
function pickTrailerKey(videos: readonly TmdbVideo[]): string | null {
  const trailers = videos.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );
  const rank = (v: TmdbVideo) =>
    (v.iso_639_1 === "fr" ? 0 : 2) + (v.official ? 0 : 1);
  const [best] = trailers
    .map((video, index) => ({ video, index }))
    .sort((a, b) => rank(a.video) - rank(b.video) || a.index - b.index);
  return best?.video.key ?? null;
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
    genreIds: (details.genres ?? []).map((g) => g.id),
    trailerKey: pickTrailerKey(details.videos?.results ?? []),
  };
}

export async function discoverDeck(
  client: TmdbClient,
  deck: DeckId,
  page: number,
): Promise<DiscoverPage> {
  const data = await client.get(
    "/discover/movie",
    { ...deckParams(deck), include_adult: false, page },
    tmdbDiscoverSchema,
    { revalidateSeconds: DISCOVER_REVALIDATE_SECONDS },
  );
  return {
    ids: data.results.map((r) => r.id),
    totalPages: Math.min(data.total_pages, MAX_TMDB_PAGES),
  };
}

/** `fresh` skips Next's 24 h cache (daily refresh). */
export async function getMovieSnapshot(
  client: TmdbClient,
  tmdbId: number,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<MovieSnapshot> {
  const details = await client.get(
    `/movie/${tmdbId}`,
    {
      append_to_response: "watch/providers,videos",
      // Appended videos follow `language` (fr-FR) unless widened: few films
      // have a French trailer, so English ones are the fallback.
      include_video_language: "fr,en",
    },
    tmdbMovieDetailsSchema,
    fresh ? undefined : { revalidateSeconds: DETAILS_REVALIDATE_SECONDS },
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
