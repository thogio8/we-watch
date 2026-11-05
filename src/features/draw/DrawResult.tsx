"use client";

import { motion } from "motion/react";
import type { Ref } from "react";
import { isFavorite, isMatch, type Movie } from "@/domain/movie";
import { computeEndTime, formatClock } from "@/domain/time";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { FavoriteStamp } from "@/ui/FavoriteStamp";
import { MatchStamp } from "@/ui/MatchStamp";
import { Poster } from "@/ui/Poster";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import { TicketDetails } from "@/ui/TicketDetails";
import { stampVariants, ticketVariants } from "./drawMotion";
import { DrawPile, type DrawPileProps } from "./DrawPile";
import styles from "./DrawScreen.module.css";

/**
 * Follows the screen height so RETIRER / ON LE REGARDE stay in sight on small
 * phones: 290 px from an 844 px tall screen, 120 px at least.
 */
const POSTER_HEIGHT = "clamp(120px, calc(100dvh - 554px), 290px)";

interface DrawResultProps {
  movie: Movie;
  now: Date | null;
  reduce: boolean;
  /** The ticket's wrapper, measured when it is torn. */
  ticketRef: Ref<HTMLDivElement>;
  pile: DrawPileProps;
  isWatching: boolean;
  onBack: () => void;
  onReject: () => void;
  onWatch: () => void;
}

/** The drawn movie's ticket, to reject (torn), to watch, or to leave. */
export function DrawResult({
  movie,
  now,
  reduce,
  ticketRef,
  pile,
  isWatching,
  onBack,
  onReject,
  onWatch,
}: DrawResultProps) {
  return (
    <>
      <div className={styles.resultHead}>
        <button
          type="button"
          className={styles.back}
          disabled={isWatching}
          onClick={onBack}
        >
          ← RETOUR
        </button>
        <p className={cx(styles.small, styles.kicker)}>Ce soir, ce sera…</p>
      </div>
      <motion.div
        ref={ticketRef}
        className={styles.ticket}
        variants={ticketVariants(reduce)}
      >
        <Ticket
          posterHeight={POSTER_HEIGHT}
          adaptive
          poster={
            <>
              <Poster path={movie.posterPath} title={movie.title} size="w500" />
              {/* Shown, not buttons: marking happens on the list or page. */}
              {isMatch(movie) && (
                <MatchStamp size="small" className={styles.matchCorner} />
              )}
              {isFavorite(movie) && <FavoriteStamp on />}
            </>
          }
          stamp={
            <motion.div
              className={styles.endStamp}
              variants={stampVariants(reduce)}
            >
              <EndStamp runtimeMinutes={movie.runtimeMinutes} now={now} />
            </motion.div>
          }
        >
          <TicketDetails movie={movie} platforms="all" stampRoom />
        </Ticket>
      </motion.div>
      <div className={styles.actions}>
        <Button variant="secondary" disabled={isWatching} onClick={onReject}>
          RETIRER
        </Button>
        <Button variant="primary" disabled={isWatching} onClick={onWatch}>
          ON LE REGARDE
        </Button>
      </div>
      <DrawPile {...pile} />
    </>
  );
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
