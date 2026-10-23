import "server-only";
import { createDatabase } from "@/db/create-database";
import {
  createMoviesRepository,
  type MoviesRepository,
} from "@/db/movies-repository";
import { getServerEnv } from "@/env";
import type { DeckDeps } from "@/features/swipe/deck";
import { createTmdbClient, type TmdbClient } from "@/tmdb/client";
import { discoverTopRated, getMovieSnapshot } from "@/tmdb/movies";

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
  tmdbClient ??= createTmdbClient({
    accessToken: getServerEnv().TMDB_ACCESS_TOKEN,
  });
  return tmdbClient;
}

export function getDeckDeps(): DeckDeps {
  const client = getTmdbClient();
  const repo = getMoviesRepository();
  return {
    discover: (page) => discoverTopRated(client, page),
    snapshot: (id) => getMovieSnapshot(client, id),
    decidedIds: () => repo.decidedIds(),
  };
}
