"use client";

import { Button } from "@/ui/Button";
import { Poster } from "@/ui/Poster";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import styles from "./error.module.css";

interface ErrorPageProps {
  retry: () => void;
}

export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <main className={styles.page}>
      <Ticket
        posterHeight={160}
        poster={
          <div aria-hidden="true">
            <Poster path={null} title="Bobine" size="w342" />
            <Stamp tone="paper" tilt={-5} className={styles.stamp}>
              HORS SERVICE
            </Stamp>
          </div>
        }
      >
        <h1 className={styles.title}>OUPS, LA BOBINE A SAUTÉ</h1>
      </Ticket>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => retry()}>
          RÉESSAYER
        </Button>
      </div>
    </main>
  );
}
