"use client";

import { motion } from "motion/react";
import type { Ref } from "react";
import type { Movie } from "@/domain/movie";
import { computeEndTime, formatClock } from "@/domain/time";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Poster } from "@/ui/Poster";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import { TicketDetails } from "@/ui/TicketDetails";
import { TornPile } from "@/ui/TornPile";
import { stampVariants, ticketVariants } from "./drawMotion";
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
  pileCount: number;
  isWatching: boolean;
  onReject: () => void;
  onWatch: () => void;
}

/** The drawn movie's ticket, to reject (torn) or to watch. */
export function DrawResult({
  movie,
  now,
  reduce,
  ticketRef,
  pileCount,
  isWatching,
  onReject,
  onWatch,
}: DrawResultProps) {
  return (
    <>
      <p className={cx(styles.small, styles.kicker)}>Ce soir, ce sera…</p>
      <motion.div
        ref={ticketRef}
        className={styles.ticket}
        variants={ticketVariants(reduce)}
      >
        <Ticket
          posterHeight={POSTER_HEIGHT}
          adaptive
          poster={
            <Poster path={movie.posterPath} title={movie.title} size="w500" />
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
      <TornPile count={pileCount} label="PAS CE SOIR" />
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
