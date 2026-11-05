"use server";

import type { MovieSnapshot } from "@/domain/movie";
import type {
  ApplyResult,
  SwipeDecision,
  SwipeOutcome,
} from "@/domain/transitions";
import {
  getDecisions,
  getDeckDeps,
  getGroupWishes,
  getSnapshots,
  getTmdbClient,
} from "@/server/container";
import { assertMember } from "@/server/groups";
import { revalidateListPages } from "@/server/revalidate";
import {
  assertSwipeDecision,
  assertTmdbId,
  isPositiveInt,
} from "@/server/validate";
import { TmdbError } from "@/tmdb/client";
import { type DeckId, isDeckId } from "@/tmdb/decks";
import { getMovieSnapshot } from "@/tmdb/movies";
import { type DeckBatch, loadDeckBatch } from "./deck";

export type { SwipeDecision };

export type LoadMoreResult = { ok: true; batch: DeckBatch } | { ok: false };

/** A swipe, bound by the page to the displayed group. */
export type SendDecision = (
  tmdbId: number,
  decision: SwipeDecision,
) => Promise<SwipeOutcome>;

/** The undo of a swipe, bound by the page to the displayed group. */
export type SendUndo = (
  tmdbId: number,
  decision: SwipeDecision,
) => Promise<ApplyResult>;

/** The next batch of a deck, bound by the page to the displayed group. */
export type LoadCards = (deck: DeckId, page: number) => Promise<LoadMoreResult>;

/**
 * The snapshot a « ON LE VEUT » stores: the group's own when the movie is
 * already in its list (read in the database, never decided by the client),
 * so TMDB may be down; otherwise TMDB's (24 h cache).
 */
async function snapshotToKeep(
  groupId: string,
  tmdbId: number,
): Promise<MovieSnapshot> {
  const stored = await getSnapshots().getListed(groupId, tmdbId);
  return stored ?? (await getMovieSnapshot(getTmdbClient(), tmdbId));
}

/**
 * « ON LE VEUT » / « BOF », by me in the group; `matched` tells that mine was
 * the last wish. « BOF » needs no snapshot, so it works with TMDB down.
 * result "noop" means this swipe created nothing (another device was first):
 * nothing to undo.
 */
export async function decideSwipe(
  groupId: string,
  tmdbId: number,
  decision: SwipeDecision,
): Promise<SwipeOutcome> {
  const { user } = await assertMember(groupId);
  assertTmdbId("decideSwipe", tmdbId);
  assertSwipeDecision("decideSwipe", decision);
  const who = { groupId, userId: user.userId, tmdbId };
  const outcome = await getDecisions().swipe(
    decision === "keep"
      ? { ...who, decision, snapshot: await snapshotToKeep(groupId, tmdbId) }
      : { ...who, decision },
  );
  // TIRER and LISTE, kept on the phone, must show it; the deck on screen is
  // not re-rendered (R10).
  revalidateListPages();
  return outcome;
}

/** « ↺ ANNULER »: takes back only what this device's swipe created. */
export async function undoSwipe(
  groupId: string,
  tmdbId: number,
  decision: SwipeDecision,
): Promise<ApplyResult> {
  const { user } = await assertMember(groupId);
  assertTmdbId("undoSwipe", tmdbId);
  assertSwipeDecision("undoSwipe", decision);
  const result = await getDecisions().undoSwipe({
    groupId,
    userId: user.userId,
    tmdbId,
    decision,
  });
  revalidateListPages();
  return result;
}

/**
 * Next batch of `deck` from `page`, without the group's list nor my BOF. The
 * first page starts with what the group wants and I have not swiped. TMDB
 * being down is expected: `{ ok: false }`, unless that queue is not empty: it
 * is served alone, and page 1 is asked again with the next batch.
 */
export async function loadMoreCards(
  groupId: string,
  deck: DeckId,
  page: number,
): Promise<LoadMoreResult> {
  const { user } = await assertMember(groupId);
  if (!isDeckId(deck)) {
    throw new Error(`loadMoreCards: invalid deck ${String(deck)}`);
  }
  if (!isPositiveInt(page)) {
    throw new Error(`loadMoreCards: invalid page ${String(page)}`);
  }
  const queue =
    page === 1 ? await getGroupWishes().pending(groupId, user.userId) : [];
  const deps = getDeckDeps(deck, groupId, user.userId);
  try {
    const batch = await loadDeckBatch(deps, page);
    const wanted = new Set(queue.map((card) => card.tmdbId));
    const cards = batch.cards.filter((card) => !wanted.has(card.tmdbId));
    return { ok: true, batch: { ...batch, cards: [...queue, ...cards] } };
  } catch (error) {
    if (!(error instanceof TmdbError)) throw error;
    return queue.length > 0
      ? { ok: true, batch: { cards: queue, nextPage: 1 } }
      : { ok: false };
  }
}
