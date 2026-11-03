import type { ReactNode } from "react";
import { Poster } from "@/ui/Poster";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import styles from "./error.module.css";

interface StatusPageProps {
  /** On the reel: « HORS SERVICE », « 404 ». */
  stamp: string;
  title: string;
  /** The way out, under the ticket. */
  children: ReactNode;
}

/** A page instead of the one asked for: an error, or none at that address. */
export function StatusPage({ stamp, title, children }: StatusPageProps) {
  return (
    <main className={styles.page}>
      <Ticket
        posterHeight={200}
        poster={
          <div className={styles.art} aria-hidden="true">
            <Poster path={null} title="Bobine" size="w342" />
            <Stamp tone="paper" tilt={-5} className={styles.stamp}>
              {stamp}
            </Stamp>
          </div>
        }
      >
        <h1 className={styles.title}>{title}</h1>
      </Ticket>
      <div className={styles.actions}>{children}</div>
    </main>
  );
}
