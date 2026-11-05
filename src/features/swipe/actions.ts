"use server";

import type { ApplyResult, SwipeDecision } from "@/domain/transitions";
import { getDecisions, getDeckDeps, getTmdbClient } from "@/server/container";
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

/** A swipe or its undo, bound by the page to the displayed group. */
export type SendSwipe = (
  tmdbId: number,
  decision: SwipeDecision,
) => Promise<ApplyResult>;

/** The next batch of a deck, bound by the page to the displayed group. */
export type LoadCards = (deck: DeckId, page: number) => Promise<LoadMoreResult>;

/**
 * « ON LE VEUT » / « BOF », by me in the group. « ON LE VEUT » fetches the
 * snapshot again here (24 h cache) rather than trusting the client; « BOF »
 * needs none, so it works with TMDB down. "noop" means this swipe created
 * nothing (another device was first): nothing to undo.
 */
export async function decideSwipe(
  groupId: string,
  tmdbId: number,
  decision: SwipeDecision,
): Promise<ApplyResult> {
  const { user } = await assertMember(groupId);
  assertTmdbId("decideSwipe", tmdbId);
  assertSwipeDecision("decideSwipe", decision);
  const who = { groupId, userId: user.userId, tmdbId };
  const { result } = await getDecisions().swipe(
    decision === "keep"
      ? {
          ...who,
          decision,
          snapshot: await getMovieSnapshot(getTmdbClient(), tmdbId),
        }
      : { ...who, decision },
  );
  // TIRER and LISTE, kept on the phone, must show it; the deck on screen is
  // not re-rendered (R10).
  revalidateListPages();
  return result;
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
 * Next batch of `deck` from `page`, without the group's list nor my BOF.
 * TMDB being down is expected: `{ ok: false }`.
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
  const deps = getDeckDeps(deck, groupId, user.userId);
  try {
    return { ok: true, batch: await loadDeckBatch(deps, page) };
  } catch (error) {
    if (error instanceof TmdbError) return { ok: false };
    throw error;
  }
}
