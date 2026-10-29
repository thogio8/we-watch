"use server";

import { assertSignedIn } from "@/server/session";
import {
  getDeckDeps,
  getMoviesRepository,
  getTmdbClient,
} from "@/server/container";
import { revalidateGroupPages } from "@/server/revalidate";
import { TmdbError } from "@/tmdb/client";
import {
  type ApplyResult,
  type SwipeDecision,
  SWIPES,
} from "@/domain/transitions";
import {
  assertSwipeDecision,
  assertTmdbId,
  isPositiveInt,
} from "@/server/validate";
import { type DeckId, isDeckId } from "@/tmdb/decks";
import { getMovieSnapshot } from "@/tmdb/movies";
import { type DeckBatch, loadDeckBatch } from "./deck";

export type { SwipeDecision };

export type LoadMoreResult = { ok: true; batch: DeckBatch } | { ok: false };

/**
 * « ON LE VEUT » / « BOF ». The snapshot is fetched again here (24 h cache)
 * rather than trusted from the client. The first decision wins: "noop" means
 * the movie was already decided (another device), so there is nothing to undo.
 */
export async function decideSwipe(
  tmdbId: number,
  decision: SwipeDecision,
): Promise<ApplyResult> {
  await assertSignedIn();
  assertTmdbId("decideSwipe", tmdbId);
  assertSwipeDecision("decideSwipe", decision);
  const snapshot = await getMovieSnapshot(getTmdbClient(), tmdbId);
  const result = await getMoviesRepository().apply(
    SWIPES[decision].action,
    tmdbId,
    snapshot,
  );
  // TIRER and LISTE, kept on the phone, must show it; the deck on screen is
  // not re-rendered (R10).
  revalidateGroupPages();
  return result;
}

/** « ↺ ANNULER »: forgets a swipe that this device applied. */
export async function undoSwipe(
  tmdbId: number,
  decision: SwipeDecision,
): Promise<ApplyResult> {
  await assertSignedIn();
  assertTmdbId("undoSwipe", tmdbId);
  assertSwipeDecision("undoSwipe", decision);
  const result = await getMoviesRepository().undoSwipe(tmdbId, decision);
  revalidateGroupPages();
  return result;
}

/** Next batch of `deck` from `page`. TMDB being down is expected: `{ ok: false }`. */
export async function loadMoreCards(
  deck: DeckId,
  page: number,
): Promise<LoadMoreResult> {
  await assertSignedIn();
  if (!isDeckId(deck)) {
    throw new Error(`loadMoreCards: invalid deck ${String(deck)}`);
  }
  if (!isPositiveInt(page)) {
    throw new Error(`loadMoreCards: invalid page ${String(page)}`);
  }
  try {
    return { ok: true, batch: await loadDeckBatch(getDeckDeps(deck), page) };
  } catch (error) {
    if (error instanceof TmdbError) return { ok: false };
    throw error;
  }
}
