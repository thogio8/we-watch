"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import type { DrawSessionState } from "@/domain/draw-session";
import type { Movie } from "@/domain/movie";
import { computeEndTime, formatClock } from "@/domain/time";
import {
  filterTonight,
  isFiltering,
  NO_FILTERS,
  sanitizeFilters,
  tonightPlatforms,
} from "@/domain/tonight";
import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { Lines } from "@/ui/Lines";
import { movieMeta } from "@/ui/movieMeta";
import { Poster } from "@/ui/Poster";
import { ProviderTags } from "@/ui/ProviderTags";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import { TornPile } from "@/ui/TornPile";
import { TrailerLink } from "@/ui/TrailerLink";
import styles from "./DrawScreen.module.css";
import { useDrawSession } from "./DrawSessionProvider";
import { TonightPanel } from "./TonightPanel";
import { useMinuteClock } from "./useMinuteClock";

interface DrawScreenProps {
  toWatch: Movie[];
  counts: { toWatch: number; watched: number };
  onWatched: (tmdbId: number) => Promise<void>;
}

type View =
  | { phase: "home" }
  | { phase: "result"; movie: Movie }
  | { phase: "exhausted" }
  | { phase: "empty" };

/**
 * What to show for the session, given the current list and the movies that
 * suit tonight's filters. The list may have changed since the draw (other tab,
 * other device): a vanished movie or newly eligible ones send the screen back
 * home, the pile being kept; an exhausted pile whose list was emptied shows
 * the empty-list screen.
 */
function resolveView(
  state: DrawSessionState,
  toWatch: Movie[],
  eligible: Movie[],
): View {
  switch (state.phase) {
    case "result": {
      const movie = toWatch.find((m) => m.tmdbId === state.currentId);
      return movie ? { phase: "result", movie } : { phase: "home" };
    }
    case "exhausted":
      if (toWatch.length === 0) return { phase: "empty" };
      return eligible.length > 0 &&
        eligible.every((m) => state.pile.includes(m.tmdbId))
        ? { phase: "exhausted" }
        : { phase: "home" };
    case "empty":
      return toWatch.length === 0 ? { phase: "empty" } : { phase: "home" };
    case "home":
      return { phase: "home" };
  }
}

/** How the current view leaves the screen: torn into the pile, or a plain fade. */
type Exit = "tear" | "fade";

const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n > 1 ? pluralForm : singular}`;

const POSTER_HEIGHT = 290;

/** Tear-line x positions (%) and their depth (px) around the perforation. */
const TEAR_POINTS = [
  [115, -4],
  [85, 6],
  [70, -6],
  [55, 8],
  [40, -4],
  [25, 7],
  [10, -5],
  [-15, 5],
] as const;

/** Clip path whose bottom edge zigzags around `y(offset)` px from the top. */
const clipAt = (y: (offset: number) => number) =>
  `polygon(-15% -60px, 115% -60px, ${TEAR_POINTS.map(
    ([x, offset]) => `${x}% ${y(offset)}px`,
  ).join(", ")})`;

// Same points in px, so motion can tween between them. The intact clip leaves
// room for the offset shadow and glow; the torn one rips along the perforation.
const INTACT = clipAt(() => 600);
const TORN = clipAt((offset) => POSTER_HEIGHT + offset);

function viewVariants(reduce: boolean): Variants {
  if (reduce) return { hidden: {}, shown: {}, exit: {} };
  return {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: 0.2 } },
    // A torn ticket needs the screen to stay put while it falls onto the pile.
    exit: (exit: Exit) =>
      exit === "tear" ? {} : { opacity: 0, transition: { duration: 0.15 } },
  };
}

function ticketVariants(reduce: boolean): Variants {
  if (reduce) return { hidden: {}, shown: {}, exit: {} };
  return {
    // Slides out of the ticket machine.
    hidden: { y: -60, rotate: -3, opacity: 0 },
    shown: {
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 22 },
    },
    // « RETIRER »: torn along the perforation, then dropped onto the pile.
    exit: (exit: Exit) =>
      exit === "tear"
        ? {
            clipPath: [INTACT, TORN, TORN],
            rotate: [0, -4, -14],
            y: [0, 6, 220],
            scale: [1, 1, 0.2],
            opacity: [1, 1, 0],
            transition: { duration: 0.6, times: [0, 0.35, 1], ease: "easeIn" },
          }
        : { opacity: 0, transition: { duration: 0.15 } },
  };
}

function stampVariants(reduce: boolean): Variants {
  if (reduce) return { hidden: {}, shown: {}, exit: {} };
  return {
    // Falls onto the ticket with a slight spin.
    hidden: { opacity: 0, scale: 2.4, rotate: 16 },
    shown: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { delay: 0.35, type: "spring", stiffness: 520, damping: 20 },
    },
  };
}

/** « FINI À 23H12 », or « DURÉE INCONNUE » when TMDB has no runtime. */
function EndStamp({
  runtimeMinutes,
  now,
}: {
  runtimeMinutes: number | null;
  now: Date | null;
}) {
  if (!runtimeMinutes) {
    return (
      <Stamp tone="yellow" tilt={7}>
        DURÉE INCONNUE
      </Stamp>
    );
  }
  const end = now && computeEndTime(now, runtimeMinutes);
  return end ? (
    <Stamp tone="yellow" tilt={7}>
      {`FINI À ${formatClock(end)}`}
    </Stamp>
  ) : null;
}

/**
 * One screen of the draw. While it leaves (e.g. the torn ticket falling), it is
 * inert: a second tap on RETIRER must not reject a movie nobody has seen yet.
 */
function Screen({
  reduce,
  children,
}: {
  reduce: boolean;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return (
    <motion.main
      className={styles.screen}
      variants={viewVariants(reduce)}
      initial="hidden"
      animate="shown"
      exit="exit"
      inert={!present}
    >
      {children}
    </motion.main>
  );
}

export function DrawScreen({ toWatch, counts, onWatched }: DrawScreenProps) {
  const { state, dispatch, filters: chosen, setFilters } = useDrawSession();
  const reduce = useReducedMotion() ?? false;
  const now = useMinuteClock();
  const [exit, setExit] = useState<Exit>("fade");
  const [isWatching, startWatching] = useTransition();

  const platforms = tonightPlatforms(toWatch);
  const filters = sanitizeFilters(chosen, toWatch);
  const filtering = isFiltering(filters);
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

  const draw = (type: "draw" | "reject" | "reset_pile") => {
    setExit(type === "reject" ? "tear" : "fade");
    dispatch({ type, candidateIds, roll: Math.random() });
  };

  const clearFilters = () => {
    setFilters({ ...NO_FILTERS });
    setExit("fade");
    dispatch({ type: "back_home" });
  };

  const watch = (tmdbId: number) => {
    startWatching(async () => {
      await onWatched(tmdbId);
      startWatching(() => {
        setExit("fade");
        dispatch({ type: "watched" });
      });
    });
  };

  const key =
    view.phase === "result" ? `result-${view.movie.tmdbId}` : view.phase;

  return (
    <AnimatePresence mode="wait" custom={exit} initial={false}>
      <Screen key={key} reduce={reduce}>
        {view.phase === "home" && (
          <>
            <h1 className={styles.logo}>
              <Lines lines={["CE SOIR", "ON REGARDE"]} />
            </h1>
            <p className={styles.small}>
              {plural(counts.toWatch, "film", "films")} à regarder ·{" "}
              {plural(counts.watched, "vu", "vus")}
            </p>
            {toWatch.length > 0 && (
              <TonightPanel
                filters={filters}
                platforms={platforms}
                onChange={setFilters}
              />
            )}
            {filtering && eligible.length === 0 ? (
              <>
                <p className={styles.nothing}>AUCUN FILM NE COLLE</p>
                <div className={styles.actions}>
                  <Button variant="primary" onClick={clearFilters}>
                    ENLEVER LES FILTRES
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className={
                  toWatch.length > 0
                    ? `${styles.big} ${styles.compact}`
                    : styles.big
                }
                onClick={() => draw("draw")}
              >
                <Lines
                  lines={
                    filtering
                      ? ["TIRER", `PARMI ${eligible.length}`]
                      : ["TIRER", "UN", "FILM"]
                  }
                />
              </button>
            )}
            <p className={`${styles.small} ${styles.clock}`}>
              {now === null ? " " : `Il est ${formatClock(now)}`}
            </p>
          </>
        )}

        {view.phase === "result" && (
          <>
            <p className={`${styles.small} ${styles.kicker}`}>
              Ce soir, ce sera…
            </p>
            <motion.div
              className={styles.ticket}
              variants={ticketVariants(reduce)}
            >
              <Ticket
                posterHeight={POSTER_HEIGHT}
                poster={
                  <>
                    <Poster
                      path={view.movie.posterPath}
                      title={view.movie.title}
                      size="w500"
                    />
                    <motion.div
                      className={styles.endStamp}
                      variants={stampVariants(reduce)}
                    >
                      <EndStamp
                        runtimeMinutes={view.movie.runtimeMinutes}
                        now={now}
                      />
                    </motion.div>
                  </>
                }
              >
                <h2 className={styles.title}>{view.movie.title}</h2>
                <p className={styles.meta}>{movieMeta(view.movie)}</p>
                <ProviderTags providers={view.movie.providers} />
                <TrailerLink
                  trailerKey={view.movie.trailerKey}
                  title={view.movie.title}
                />
                {view.movie.overview && (
                  <p className={styles.overview}>{view.movie.overview}</p>
                )}
              </Ticket>
            </motion.div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={isWatching}
                onClick={() => draw("reject")}
              >
                RETIRER
              </Button>
              <Button
                variant="primary"
                disabled={isWatching}
                onClick={() => watch(view.movie.tmdbId)}
              >
                ON LE REGARDE
              </Button>
            </div>
            <TornPile count={pileCount} label="PAS CE SOIR" />
          </>
        )}

        {view.phase === "exhausted" && (
          <>
            <h1 className={`${styles.logo} ${styles.dropped}`}>
              <Lines lines={["VOUS ÊTES", "DIFFICILES", "CE SOIR"]} />
            </h1>
            <TornPile count={pileCount} label="PAS CE SOIR" />
            <p className={styles.small}>
              {exhaustedText(eligible.length, filtering)}
            </p>
            <div className={`${styles.actions} ${styles.spaced}`}>
              <Button variant="primary" onClick={() => draw("reset_pile")}>
                ON REMET TOUT
              </Button>
            </div>
            <p className={`${styles.small} ${styles.or}`}>ou</p>
            <div className={styles.actions}>
              {filtering ? (
                <Button variant="secondary" onClick={clearFilters}>
                  ENLEVER LES FILTRES
                </Button>
              ) : (
                <ButtonLink href="/swipe" variant="secondary">
                  ALLER SWIPER
                </ButtonLink>
              )}
            </div>
          </>
        )}

        {view.phase === "empty" && (
          <>
            <h1 className={`${styles.logo} ${styles.dropped}`}>
              <Lines lines={["RIEN", "À TIRER", "CE SOIR"]} />
            </h1>
            <p className={`${styles.small} ${styles.emptyText}`}>
              La liste « à voir » est vide : swipez quelques films d’abord
            </p>
            <div className={`${styles.actions} ${styles.spaced}`}>
              <ButtonLink href="/swipe" variant="primary">
                ALLER SWIPER
              </ButtonLink>
            </div>
          </>
        )}
      </Screen>
    </AnimatePresence>
  );
}

function exhaustedText(count: number, filtering: boolean): string {
  if (filtering) {
    return count === 1
      ? "Le seul film qui collait est passé à la trappe"
      : `Les ${count} films qui collaient sont passés à la trappe`;
  }
  return count === 1
    ? "Le seul film de la liste est passé à la trappe"
    : `Les ${count} films sont passés à la trappe`;
}

/** Shown while the list loads: the home title, without numbers nor button. */
export function DrawScreenFallback() {
  return (
    <main className={styles.screen} aria-busy="true">
      <h1 className={styles.logo}>
        <Lines lines={["CE SOIR", "ON REGARDE"]} />
      </h1>
    </main>
  );
}
