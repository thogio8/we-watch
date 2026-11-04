import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createAuth } from "@/auth/create-auth";
import { createAccount, type Account } from "@/db/account";
import { createDatabase, type Database } from "@/db/create-database";
import { createDecisions, type Decisions } from "@/db/decisions";
import { createFavorites, type Favorites } from "@/db/favorites";
import { createGroupList, type GroupList } from "@/db/group-list";
import { createGroups, type Groups } from "@/db/groups";
import { createHousekeeping, type Housekeeping } from "@/db/housekeeping";
import { createRateLimits, type RateLimits } from "@/db/rate-limit";
import { createSnapshots, type Snapshots } from "@/db/snapshots";
import { getServerEnv } from "@/env";
import type { RefreshDeps } from "@/features/refresh/refresh-movies";
import type { DeckDeps } from "@/features/swipe/deck";
import { createTmdbClient, type TmdbClient } from "@/tmdb/client";
import type { DeckId } from "@/tmdb/decks";
import { discoverDeck, getMovieSnapshot } from "@/tmdb/movies";

let database: Database | undefined;
let account: Account | undefined;
let decisions: Decisions | undefined;
let favorites: Favorites | undefined;
let groupList: GroupList | undefined;
let groups: Groups | undefined;
let housekeeping: Housekeeping | undefined;
let rateLimits: RateLimits | undefined;
let snapshots: Snapshots | undefined;
let tmdbClient: TmdbClient | undefined;
let auth: Auth | undefined;

function getDatabase(): Database {
  const env = getServerEnv();
  database ??= createDatabase(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
  return database;
}

export function getAccount(): Account {
  account ??= createAccount(getDatabase());
  return account;
}

export function getDecisions(): Decisions {
  decisions ??= createDecisions(getDatabase());
  return decisions;
}

export function getFavorites(): Favorites {
  favorites ??= createFavorites(getDatabase());
  return favorites;
}

export function getGroupList(): GroupList {
  groupList ??= createGroupList(getDatabase());
  return groupList;
}

export function getGroups(): Groups {
  groups ??= createGroups(getDatabase());
  return groups;
}

/** The cron's daily purge of rows nobody reads again. */
export function getHousekeeping(): Housekeeping {
  housekeeping ??= createHousekeeping(getDatabase());
  return housekeeping;
}

/** Attempt counters, shared by Better Auth and the Server Actions. */
export function getRateLimits(): RateLimits {
  rateLimits ??= createRateLimits(getDatabase());
  return rateLimits;
}

function getSnapshots(): Snapshots {
  snapshots ??= createSnapshots(getDatabase());
  return snapshots;
}

function buildAuth() {
  const env = getServerEnv();
  return createAuth({
    db: getDatabase(),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    rateLimits: getRateLimits(),
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

/** The deck of `userId` in `groupId`: membership is checked by the caller. */
export function getDeckDeps(
  deck: DeckId,
  groupId: string,
  userId: string,
): DeckDeps {
  const client = getTmdbClient();
  return {
    discover: (page) => discoverDeck(client, deck, page),
    snapshot: (id) => getMovieSnapshot(client, id),
    decidedIds: () => getDecisions().deckExclusions(groupId, userId),
  };
}

export function getRefreshDeps(): RefreshDeps {
  const client = getTmdbClient();
  const store = getSnapshots();
  return {
    ids: () => store.listedIds(),
    snapshot: (id) => getMovieSnapshot(client, id, { fresh: true }),
    save: (snapshot) => store.refresh(snapshot),
  };
}
