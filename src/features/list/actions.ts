"use server";

import type { MovieSnapshot, MovieStatus } from "@/domain/movie";
import { getGroupList, getTmdbClient } from "@/server/container";
import { assertMember } from "@/server/groups";
import { revalidateListPages } from "@/server/revalidate";
import { assertTmdbId } from "@/server/validate";
import { TmdbError } from "@/tmdb/client";
import { getMovieSnapshot, searchMovies } from "@/tmdb/movies";

/** A TMDB result, with its status in the group's list (null: not in it). */
export type SearchResult = MovieSnapshot & { status: MovieStatus | null };

export type SearchOutcome =
  { ok: true; results: SearchResult[] } | { ok: false };

/** Longer than any film title; anything above is not a search. */
const MAX_QUERY_LENGTH = 100;

async function applyFromList(
  groupId: string,
  action: "remove" | "unwatch",
  tmdbId: number,
): Promise<void> {
  const { user } = await assertMember(groupId);
  assertTmdbId(action, tmdbId);
  await getGroupList().apply({ groupId, userId: user.userId, action, tmdbId });
  revalidateListPages();
}

/** ✕ on « à voir »: set aside for the group, so it never comes back to its decks. */
export async function removeFromList(
  groupId: string,
  tmdbId: number,
): Promise<void> {
  await applyFromList(groupId, "remove", tmdbId);
}

/** ↺ À VOIR on « vus »: back to « à voir », `watched_at` cleared. */
export async function unwatch(groupId: string, tmdbId: number): Promise<void> {
  await applyFromList(groupId, "unwatch", tmdbId);
}

/** TMDB search (fr-FR) with each film's status. TMDB being down is expected: `{ ok: false }`. */
export async function searchCatalog(
  groupId: string,
  query: string,
): Promise<SearchOutcome> {
  await assertMember(groupId);
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
  const statuses = await getGroupList().statusesOf(
    groupId,
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
 * « + AJOUTER »: the movie goes « à voir » in the group, even if it was set
 * aside (changed our minds), and my BOF on it is erased. The snapshot is
 * fetched again here rather than trusted from the client.
 */
export async function addFromSearch(
  groupId: string,
  tmdbId: number,
): Promise<void> {
  const { user } = await assertMember(groupId);
  assertTmdbId("search_add", tmdbId);
  const snapshot = await getMovieSnapshot(getTmdbClient(), tmdbId);
  await getGroupList().apply({
    groupId,
    userId: user.userId,
    action: "search_add",
    tmdbId,
    snapshot,
  });
  revalidateListPages();
}
