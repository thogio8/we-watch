import "server-only";
import { createDatabase } from "@/db/create-database";
import {
  createMoviesRepository,
  type MoviesRepository,
} from "@/db/movies-repository";
import { getServerEnv } from "@/env";
import type { RefreshDeps } from "@/features/refresh/refresh-movies";
import type { DeckDeps } from "@/features/swipe/deck";
import { createTmdbClient, type TmdbClient } from "@/tmdb/client";
import type { DeckId } from "@/tmdb/decks";
import { discoverDeck, getMovieSnapshot } from "@/tmdb/movies";

let repository: MoviesRepository | undefined;
let tmdbClient: TmdbClient | undefined;

export function getMoviesRepository(): MoviesRepository {
  if (repository === undefined) {
    const env = getServerEnv();
    repository = createMoviesRepository(
      createDatabase(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN),
    );
  }
  return repository;
}

export function getTmdbClient(): TmdbClient {
  const env = getServerEnv();
  tmdbClient ??= createTmdbClient({
    accessToken: env.TMDB_ACCESS_TOKEN,
    baseUrl: env.TMDB_API_URL,
  });
  return tmdbClient;
}

export function getDeckDeps(deck: DeckId): DeckDeps {
  const client = getTmdbClient();
  const repo = getMoviesRepository();
  return {
    discover: (page) => discoverDeck(client, deck, page),
    snapshot: (id) => getMovieSnapshot(client, id),
    decidedIds: () => repo.decidedIds(),
  };
}

export function getRefreshDeps(): RefreshDeps {
  const client = getTmdbClient();
  const repo = getMoviesRepository();
  return {
    ids: () => repo.idsWithStatus(["to_watch", "watched"]),
    snapshot: (id) => getMovieSnapshot(client, id, { fresh: true }),
    save: (snapshot) => repo.refreshSnapshot(snapshot),
  };
}
