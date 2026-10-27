"use server";

import { assertUnlocked } from "@/access/assert-unlocked";
import type { MovieSnapshot, MovieStatus } from "@/domain/movie";
import type { MovieAction } from "@/domain/transitions";
import { getMoviesRepository, getTmdbClient } from "@/server/container";
import { revalidateListPages } from "@/server/revalidate";
import { assertTmdbId } from "@/server/validate";
import { TmdbError } from "@/tmdb/client";
import { getMovieSnapshot, searchMovies } from "@/tmdb/movies";

/** A TMDB result, with its status in our list (null: never decided). */
export type SearchResult = MovieSnapshot & { status: MovieStatus | null };

export type SearchOutcome =
  { ok: true; results: SearchResult[] } | { ok: false };

/** Longer than any film title; anything above is not a search. */
const MAX_QUERY_LENGTH = 100;

async function applyFromList(
  action: MovieAction,
  tmdbId: number,
): Promise<void> {
  assertTmdbId(action, tmdbId);
  await getMoviesRepository().apply(action, tmdbId);
  revalidateListPages();
}

/** ✕ on « à voir »: the movie becomes « refusé », so it never comes back to the swipe. */
export async function removeFromList(tmdbId: number): Promise<void> {
  await assertUnlocked();
  await applyFromList("remove", tmdbId);
}

/** ↺ À VOIR on « vus »: back to « à voir », `watched_at` cleared. */
export async function unwatch(tmdbId: number): Promise<void> {
  await assertUnlocked();
  await applyFromList("unwatch", tmdbId);
}

/** TMDB search (fr-FR) with each film's status. TMDB being down is expected: `{ ok: false }`. */
export async function searchCatalog(query: string): Promise<SearchOutcome> {
  await assertUnlocked();
  if (typeof query !== "string" || query.length > MAX_QUERY_LENGTH) {
    throw new Error("searchCatalog: invalid query");
  }
  const trimmed = query.trim();
  if (trimmed === "") return { ok: true, results: [] };
  let movies: MovieSnapshot[];
  try {
    movies = await searchMovies(getTmdbClient(), trimmed);
  } catch (error) {
    if (error instanceof TmdbError) return { ok: false };
    throw error;
  }
  const statuses = await getMoviesRepository().statusesOf(
    movies.map((m) => m.tmdbId),
  );
  return {
    ok: true,
    results: movies.map((m) => ({
      ...m,
      status: statuses.get(m.tmdbId) ?? null,
    })),
  };
}

/**
 * « + AJOUTER »: the movie goes « à voir », even if it was « refusé » (changed
 * our minds). The snapshot is fetched again here rather than trusted from the client.
 */
export async function addFromSearch(tmdbId: number): Promise<void> {
  await assertUnlocked();
  assertTmdbId("search_add", tmdbId);
  const snapshot = await getMovieSnapshot(getTmdbClient(), tmdbId);
  await getMoviesRepository().apply("search_add", tmdbId, snapshot);
  revalidateListPages();
}
