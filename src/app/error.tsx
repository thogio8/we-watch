"use client";

import { leaveIfSignedOut } from "@/access/signed-out";
import { useEffect } from "react";
import { Button } from "@/ui/Button";
import { Poster } from "@/ui/Poster";
import { Stamp } from "@/ui/Stamp";
import { Ticket } from "@/ui/Ticket";
import styles from "./error.module.css";

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  // An action refused for want of a session that nothing caught.
  useEffect(() => leaveIfSignedOut(error), [error]);
  return (
    <main className={styles.page}>
      <Ticket
        posterHeight={200}
        poster={
          <div className={styles.art} aria-hidden="true">
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
