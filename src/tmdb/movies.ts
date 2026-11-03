import "server-only";
import type { MovieSnapshot, StreamingProvider } from "@/domain/movie";
import type { TmdbClient } from "./client";
import { type DeckId, deckParams } from "./decks";
import { pickSearchResults } from "./search-rank";
import {
  type TmdbMovieDetails,
  tmdbDiscoverSchema,
  tmdbMovieDetailsSchema,
  tmdbSearchSchema,
} from "./schemas";

const MAX_TMDB_PAGES = 500;
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

type TmdbProvider = NonNullable<
  NonNullable<TmdbMovieDetails["watch/providers"]>["results"]["FR"]
>["flatrate"];

/** French subscription offers, in TMDB's display order. */
function toProviders(flatrate: TmdbProvider = []): StreamingProvider[] {
  return [...flatrate]
    .sort((a, b) => a.display_priority - b.display_priority)
    .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path,
    }));
}

function toReleaseYear(releaseDate: string | null | undefined): number | null {
  const year = /^(\d{4})/.exec(releaseDate ?? "")?.[1];
  return year === undefined ? null : Number(year);
}

/** TMDB titles sometimes carry invisible direction marks (U+200E…). */
const DIRECTION_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const clean = (text: string) => text.replace(DIRECTION_MARKS, "").trim();

export function toSnapshot(details: TmdbMovieDetails): MovieSnapshot {
  return {
    tmdbId: details.id,
    title: clean(details.title),
    releaseYear: toReleaseYear(details.release_date),
    runtimeMinutes: details.runtime || null,
    overview: clean(details.overview ?? ""),
    posterPath: details.poster_path ?? null,
    voteAverage: details.vote_average,
    providers: toProviders(details["watch/providers"]?.results.FR?.flatrate),
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

const searchPage = (client: TmdbClient, query: string, page: number) =>
  client.get(
    "/search/movie",
    { query, include_adult: false, page },
    tmdbSearchSchema,
  );

/** The two first pages of TMDB's hits, re-ranked (see pickSearchResults). */
export async function searchMovies(
  client: TmdbClient,
  query: string,
): Promise<MovieSnapshot[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  const first = await searchPage(client, trimmed, 1);
  const hits =
    first.total_pages > 1
      ? [...first.results, ...(await searchPage(client, trimmed, 2)).results]
      : first.results;
  const ids = pickSearchResults(
    hits.map((hit) => ({ id: hit.id, voteCount: hit.vote_count })),
  );
  return Promise.all(ids.map((id) => getMovieSnapshot(client, id)));
}
