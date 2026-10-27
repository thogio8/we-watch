import type { CSSProperties, ReactNode } from "react";
import styles from "./Ticket.module.css";
import { cx } from "./cx";

interface TicketProps {
  poster: ReactNode;
  children: ReactNode;
  /**
   * Positioned against the whole ticket (not the poster), so a stamp can sit
   * on the poster of a standing ticket and on the stub of a lying one.
   */
  stamp?: ReactNode;
  /** px, or any CSS length (e.g. a clamp() following the screen height). */
  posterHeight?: number | string;
  /**
   * Lies down in a wide column (spec §12): poster on the left, a vertical
   * perforation, the stub on the right.
   */
  adaptive?: boolean;
  /** Extra class on the ticket itself (e.g. its width in a form). */
  className?: string;
}

const DEFAULT_POSTER_HEIGHT = 330;

/** The poster part, for code that needs its live size (the torn ticket). */
export const TICKET_POSTER_ATTR = "data-ticket-poster";

export function Ticket({
  poster,
  children,
  stamp,
  posterHeight = DEFAULT_POSTER_HEIGHT,
  adaptive = false,
  className,
}: TicketProps) {
  const classes = cx(styles.ticket, adaptive && styles.adaptive, className);
  const style = {
    "--poster-h":
      typeof posterHeight === "number" ? `${posterHeight}px` : posterHeight,
  } as CSSProperties;
  return (
    <article className={classes} style={style}>
      <div className={styles.poster} {...{ [TICKET_POSTER_ATTR]: "" }}>
        {poster}
      </div>
      <span
        className={`${styles.stub} ${styles.stubLeft}`}
        aria-hidden="true"
      />
      <span
        className={`${styles.stub} ${styles.stubRight}`}
        aria-hidden="true"
      />
      <div className={styles.info}>{children}</div>
      {stamp}
    </article>
  );
}
