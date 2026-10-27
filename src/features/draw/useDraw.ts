"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Movie } from "@/domain/movie";
import {
  filterTonight,
  isFiltering,
  NO_FILTERS,
  sanitizeFilters,
  tonightPlatforms,
} from "@/domain/tonight";
import { FADE, type Exit, tearOf } from "./drawMotion";
import { useDrawSession } from "./DrawSessionProvider";
import { resolveView } from "./drawView";
import { useMinuteClock } from "./useMinuteClock";

export type DrawAction = "draw" | "reject" | "reset_pile";

/**
 * The draw session as the screen sees it: tonight's filters applied to the
 * list, the view to show, how it leaves, and the user's moves.
 */
export function useDraw(
  toWatch: Movie[],
  onWatched: (tmdbId: number) => Promise<void>,
) {
  const { state, dispatch, filters: chosen, setFilters } = useDrawSession();
  const ticketRef = useRef<HTMLDivElement>(null);
  const now = useMinuteClock();
  const [exit, setExit] = useState<Exit>(FADE);
  const [isWatching, startWatching] = useTransition();

  const filters = sanitizeFilters(chosen, toWatch);
  // No clock before hydration: the bedtime cannot be checked yet.
  const eligible =
    now === null ? toWatch : filterTonight(toWatch, filters, now);

  const view = resolveView(state, toWatch, eligible);
  // Keep the session in line with a fall back home, so a stale movie cannot
  // resurface. An exhausted session shown as « empty » is left as is.
  const stale = view.phase === "home" && state.phase !== "home";
  useEffect(() => {
    if (stale) dispatch({ type: "back_home" });
  }, [stale, dispatch]);

  const candidateIds = eligible.map((m) => m.tmdbId);
  const pileCount = state.pile.filter((id) => candidateIds.includes(id)).length;

  const draw = (type: DrawAction) => {
    // The ticket stands or lies depending on the screen: measure it now.
    setExit(
      type === "reject"
        ? { kind: "tear", clips: tearOf(ticketRef.current) }
        : FADE,
    );
    dispatch({ type, candidateIds, roll: Math.random() });
  };

  const clearFilters = () => {
    setFilters({ ...NO_FILTERS });
    setExit(FADE);
    dispatch({ type: "back_home" });
  };

  const watch = (tmdbId: number) => {
    startWatching(async () => {
      await onWatched(tmdbId);
      startWatching(() => {
        setExit(FADE);
        dispatch({ type: "watched" });
      });
    });
  };

  return {
    view,
    exit,
    now,
    ticketRef,
    filters,
    setFilters,
    platforms: tonightPlatforms(toWatch),
    filtering: isFiltering(filters),
    eligibleCount: eligible.length,
    pileCount,
    isWatching,
    draw,
    clearFilters,
    watch,
  };
}
