"use client";

import {
  motion,
  type PanInfo,
  useIsPresent,
  useMotionValue,
  useTransform,
  type Variants,
} from "motion/react";
import { useRef } from "react";
import type { MovieSnapshot } from "@/domain/movie";
import { distinctPlatforms } from "@/domain/tonight";
import { movieMeta } from "@/ui/movieMeta";
import { Poster } from "@/ui/Poster";
import { ProviderTags } from "@/ui/ProviderTags";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import { TrailerLink } from "@/ui/TrailerLink";
import type { SwipeDecision } from "./actions";
import styles from "./SwipeCard.module.css";

/** Share of the card width past which a released drag decides. */
const DISTANCE_THRESHOLD = 0.3;
/** A flick (px/s) decides even if short of the threshold… */
const FLICK_VELOCITY = 500;
/** …as long as the finger really moved (px): below, it is a tap. */
const FLICK_MIN_OFFSET = 24;

/** What a released drag means: far enough, or flicked the same way. */
export function decisionFromDrag(
  offset: number,
  velocity: number,
  width: number,
): SwipeDecision | null {
  const direction: SwipeDecision = offset > 0 ? "keep" : "reject";
  if (Math.abs(offset) >= width * DISTANCE_THRESHOLD) return direction;
  const flicked =
    Math.abs(offset) >= FLICK_MIN_OFFSET &&
    Math.abs(velocity) >= FLICK_VELOCITY &&
    Math.sign(velocity) === Math.sign(offset);
  return flicked ? direction : null;
}

export type CardPosition = "top" | "behind";

/**
 * Follows the screen height so BOF / ON LE VEUT stay in sight on small phones:
 * 320 px from an 844 px tall screen, 120 px at least.
 */
export const POSTER_HEIGHT = "clamp(120px, calc(100dvh - 524px), 320px)";
/** Drag distance (px) over which the card tilts to its maximum. */
const TILT_DISTANCE = 300;
const MAX_TILT = 14;

const SETTLE = { type: "spring", stiffness: 380, damping: 32 } as const;
const INSTANT = { duration: 0 } as const;

/**
 * enter: a card joining the deck (or coming back after a failed save);
 * top/behind: its place in the two-card stack; exit: thrown off-screen in the
 * direction of the decision (AnimatePresence's `custom`), keeping the drag's
 * velocity. Reduced motion: same places, no movement.
 */
function cardVariants(reduce: boolean): Variants {
  return {
    enter: reduce ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 30 },
    // x: 0 also brings back a card whose save failed mid-flight.
    top: {
      opacity: 1,
      x: 0,
      scale: 1,
      y: 0,
      zIndex: 2,
      transition: reduce ? INSTANT : SETTLE,
    },
    behind: {
      opacity: 1,
      x: 0,
      scale: 0.94,
      y: 16,
      zIndex: 1,
      transition: reduce ? INSTANT : SETTLE,
    },
    exit: (decision: SwipeDecision) =>
      reduce
        ? { zIndex: 3, transition: INSTANT }
        : {
            x: (decision === "keep" ? 1 : -1) * (window.innerWidth + 200),
            zIndex: 3,
            transition: { type: "spring", bounce: 0, duration: 0.35 },
          },
  };
}

interface SwipeCardProps {
  movie: MovieSnapshot;
  position: CardPosition;
  reduce: boolean;
  onDecide: (decision: SwipeDecision) => void;
}

/**
 * One movie ticket of the deck. Only the top card can be dragged; the one
 * behind it and a card on its way out are inert and hidden from assistive
 * technologies (the deck buttons act on the top card).
 */
export function SwipeCard({
  movie,
  position,
  reduce,
  onDecide,
}: SwipeCardProps) {
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(
    x,
    [-TILT_DISTANCE, 0, TILT_DISTANCE],
    [-MAX_TILT, 0, MAX_TILT],
  );
  // The verdict stamps ink in as the card is dragged their way.
  const keepOpacity = useTransform(x, [12, 64], [0, 1]);
  const rejectOpacity = useTransform(x, [-64, -12], [1, 0]);
  const active = present && position === "top";

  const release = (_: PointerEvent, info: PanInfo) => {
    const width = ref.current?.offsetWidth ?? 0;
    const decision = decisionFromDrag(info.offset.x, info.velocity.x, width);
    if (decision) onDecide(decision);
  };

  const [platform] = movie.providers;

  return (
    <motion.div
      ref={ref}
      className={styles.card}
      style={{ x, rotate: reduce ? 0 : rotate }}
      variants={cardVariants(reduce)}
      initial="enter"
      animate={position}
      exit="exit"
      drag={active ? "x" : false}
      dragSnapToOrigin
      onDragEnd={release}
      inert={!active}
      aria-hidden={active ? undefined : true}
    >
      <Ticket
        posterHeight={POSTER_HEIGHT}
        adaptive
        poster={
          <>
            <Poster path={movie.posterPath} title={movie.title} size="w500" />
            <Stamp tone="paper" tilt={7} className={styles.platform}>
              {platform ? platform.name : "PAS EN STREAMING"}
            </Stamp>
            <motion.div
              className={`${styles.verdict} ${styles.keep}`}
              style={{ opacity: keepOpacity }}
              aria-hidden="true"
            >
              <Stamp tone="yellow" tilt={-12}>
                ON LE VEUT ♥
              </Stamp>
            </motion.div>
            <motion.div
              className={`${styles.verdict} ${styles.reject}`}
              style={{ opacity: rejectOpacity }}
              aria-hidden="true"
            >
              <Stamp tone="paper" tilt={12}>
                ✕ BOF
              </Stamp>
            </motion.div>
          </>
        }
      >
        <div className={styles.info}>
          <h2 className={styles.title}>{movie.title}</h2>
          <p className={styles.meta}>{movieMeta(movie)}</p>
          {/* The first platform is the stamp; list them all when there are more. */}
          {distinctPlatforms(movie.providers).length > 1 && (
            <ProviderTags providers={movie.providers} />
          )}
          <TrailerLink trailerKey={movie.trailerKey} title={movie.title} />
          {movie.overview && (
            <p className={styles.overview}>{movie.overview}</p>
          )}
        </div>
      </Ticket>
    </motion.div>
  );
}
