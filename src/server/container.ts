import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createAuth } from "@/auth/create-auth";
import { createDatabase, type Database } from "@/db/create-database";
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

let database: Database | undefined;
let repository: MoviesRepository | undefined;
let tmdbClient: TmdbClient | undefined;
let auth: Auth | undefined;

function getDatabase(): Database {
  const env = getServerEnv();
  database ??= createDatabase(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
  return database;
}

export function getMoviesRepository(): MoviesRepository {
  repository ??= createMoviesRepository(getDatabase());
  return repository;
}

function buildAuth() {
  const env = getServerEnv();
  return createAuth({
    db: getDatabase(),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Lets Server Actions set Better Auth's cookies; must stay the last plugin.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof buildAuth>;

export function getAuth(): Auth {
  auth ??= buildAuth();
  return auth;
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
