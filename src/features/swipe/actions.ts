"use server";

import {
  getDeckDeps,
  getMoviesRepository,
  getTmdbClient,
} from "@/server/container";
import { TmdbError } from "@/tmdb/client";
import { getMovieSnapshot } from "@/tmdb/movies";
import { type DeckBatch, loadDeckBatch } from "./deck";

export type SwipeDecision = "keep" | "reject";

export type LoadMoreResult = { ok: true; batch: DeckBatch } | { ok: false };

const ACTIONS = { keep: "swipe_keep", reject: "swipe_reject" } as const;

const isPositiveInt = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

/**
 * « ON LE VEUT » / « BOF ». The snapshot is fetched again here (24 h cache)
 * rather than trusted from the client. The first decision wins.
 */
export async function decideSwipe(
  tmdbId: number,
  decision: SwipeDecision,
): Promise<void> {
  // Server Actions are public endpoints: never trust the arguments' types.
  if (!isPositiveInt(tmdbId)) {
    throw new Error(`decideSwipe: invalid tmdbId ${String(tmdbId)}`);
  }
  if (decision !== "keep" && decision !== "reject") {
    throw new Error(`decideSwipe: invalid decision ${String(decision)}`);
  }
  const snapshot = await getMovieSnapshot(getTmdbClient(), tmdbId);
  await getMoviesRepository().apply(ACTIONS[decision], tmdbId, snapshot);
  // No revalidatePath (R10): in Next 16.4 it would re-render /swipe into every
  // swipe's response (TMDB calls the client discards). TIRER and LISTE are
  // dynamic (connection()) and staleTimes.dynamic is 0, so switching tabs
  // already shows the new counts.
}

/** Next deck batch from `page`. TMDB being down is expected: `{ ok: false }`. */
export async function loadMoreCards(page: number): Promise<LoadMoreResult> {
  if (!isPositiveInt(page)) {
    throw new Error(`loadMoreCards: invalid page ${String(page)}`);
  }
  try {
    return { ok: true, batch: await loadDeckBatch(getDeckDeps(), page) };
  } catch (error) {
    if (error instanceof TmdbError) return { ok: false };
    throw error;
  }
}
