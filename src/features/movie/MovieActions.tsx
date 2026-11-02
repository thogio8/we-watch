"use client";

import { leaveIfSignedOut } from "@/access/signed-out";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MovieStatus } from "@/domain/movie";
import { Button } from "@/ui/Button";
import styles from "./MovieScreen.module.css";

type MovieAction = (tmdbId: number) => Promise<void>;

export interface MovieActionsProps {
  tmdbId: number;
  /** Only « à voir » and « vu » movies have a page (see load.ts). */
  status: MovieStatus;
  onWatched: MovieAction;
  onUnwatch: MovieAction;
  onRemove: MovieAction;
}

/** What can be done with the movie from its page; each ends on the list. */
export function MovieActions({
  tmdbId,
  status,
  onWatched,
  onUnwatch,
  onRemove,
}: MovieActionsProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const act = (action: MovieAction) =>
    startTransition(async () => {
      setFailed(false);
      try {
        await action(tmdbId);
        router.push("/list");
      } catch (error) {
        leaveIfSignedOut(error);
        setFailed(true);
      }
    });

  return (
    <>
      <div className={styles.actions}>
        {status === "watched" ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => act(onUnwatch)}
          >
            ↺ À REVOIR
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act(onRemove)}
            >
              RETIRER
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => act(onWatched)}
            >
              ON L’A VU
            </Button>
          </>
        )}
      </div>
      {failed && (
        <p role="alert" className={styles.failed}>
          PAS RÉUSSI, RÉESSAIE
        </p>
      )}
    </>
  );
}
