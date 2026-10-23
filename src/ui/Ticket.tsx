import type { ReactNode } from "react";
import styles from "./Ticket.module.css";

interface TicketProps {
  poster: ReactNode;
  children: ReactNode;
  posterHeight?: number;
  className?: string;
}

const DEFAULT_POSTER_HEIGHT = 330;

export function Ticket({
  poster,
  children,
  posterHeight = DEFAULT_POSTER_HEIGHT,
  className,
}: TicketProps) {
  return (
    <article
      className={className ? `${styles.ticket} ${className}` : styles.ticket}
    >
      <div className={styles.poster} style={{ height: posterHeight }}>
        {poster}
      </div>
      <span
        className={`${styles.stub} ${styles.stubLeft}`}
        style={{ top: posterHeight }}
        aria-hidden="true"
      />
      <span
        className={`${styles.stub} ${styles.stubRight}`}
        style={{ top: posterHeight }}
        aria-hidden="true"
      />
      <div className={styles.info}>{children}</div>
    </article>
  );
}
