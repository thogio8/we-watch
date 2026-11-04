"use client";

import { useState, useTransition } from "react";
import { leaveIfRefused } from "@/access/refusals";
import { cx } from "@/ui/cx";
import { favoriteButtonName } from "@/ui/favorite";
import { FavoriteStamp, posterCorner } from "@/ui/FavoriteStamp";
import styles from "./MovieScreen.module.css";

interface FavoriteToggleProps {
  tmdbId: number;
  title: string;
  favorite: boolean;
  onFavorite: (tmdbId: number, on: boolean) => Promise<unknown>;
}

/**
 * The stamp on the poster is the button (variant F2): the ghost marks the
 * film as a favourite, the real stamp clears it. No optimistic update: the
 * revalidated page brings the new stamp, and the page stays.
 */
export function FavoriteToggle({
  tmdbId,
  title,
  favorite,
  onFavorite,
}: FavoriteToggleProps) {
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  // Only a stamp put down here is animated, not the one the page opens with.
  const [touched, setTouched] = useState(false);

  const toggle = () =>
    startTransition(async () => {
      setFailed(false);
      setTouched(true);
      try {
        await onFavorite(tmdbId, !favorite);
      } catch (error) {
        leaveIfRefused(error);
        setFailed(true);
      }
    });

  return (
    <>
      <button
        type="button"
        className={cx(posterCorner, styles.favorite)}
        aria-pressed={favorite}
        aria-label={favoriteButtonName(title)}
        disabled={busy}
        onClick={toggle}
      >
        {/* A new key on each change replays the stamp's landing. */}
        <span
          key={String(favorite)}
          className={cx(
            styles.stampHolder,
            touched && favorite && styles.posed,
          )}
        >
          <FavoriteStamp on={favorite} placed={false} />
        </span>
      </button>
      {failed && (
        <p role="alert" className={styles.favoriteFailed}>
          PAS RÉUSSI, RÉESSAIE
        </p>
      )}
    </>
  );
}
