"use client";

import { useTransition } from "react";
import { addedLine, wantedLine, watchedLine } from "@/domain/attribution";
import { isFavorite, type Movie } from "@/domain/movie";
import { formatShortDate } from "@/domain/time";
import { favoriteButtonName } from "@/ui/favorite";
import { MovieRow, RowButton, RowMeta } from "./MovieRow";
import { toWatchMeta } from "./toWatchMeta";
import type { FavoriteAction, ListAction } from "./useListAction";

interface ListRowProps {
  movie: Movie;
  run: (task: () => Promise<unknown>) => Promise<void>;
  onRemove: ListAction;
  onUnwatch: ListAction;
  onFavorite: FavoriteAction;
}

/** A row with its own pending state, so a double tap cannot act twice. */
export function ListRow({
  movie,
  run,
  onRemove,
  onUnwatch,
  onFavorite,
}: ListRowProps) {
  const [busy, startTransition] = useTransition();
  const act = (task: () => Promise<unknown>) =>
    startTransition(() => run(task));
  const { tmdbId, title } = movie;

  if (movie.status === "watched") {
    // « vu le JJ/MM » is on the device's clock. These rows are never
    // server-rendered (À VOIR is the default tab), so no time-zone mismatch.
    return (
      <MovieRow
        title={title}
        posterPath={movie.posterPath}
        muted
        busy={busy}
        href={`/list/${tmdbId}`}
        action={
          <RowButton
            tone="paper"
            aria-label={`Remettre ${title} à voir`}
            disabled={busy}
            onClick={() => act(() => onUnwatch(tmdbId))}
          >
            ↺ À VOIR
          </RowButton>
        }
      >
        <RowMeta>{watchedLine(movie, formatShortDate) ?? "vu"}</RowMeta>
      </MovieRow>
    );
  }
  const favorite = isFavorite(movie);
  return (
    <MovieRow
      title={title}
      posterPath={movie.posterPath}
      busy={busy}
      favorite={favorite}
      href={`/list/${tmdbId}`}
      action={
        <>
          <RowButton
            tone={favorite ? "pink" : "paper"}
            aria-label={favoriteButtonName(title)}
            aria-pressed={favorite}
            disabled={busy}
            onClick={() => act(() => onFavorite(tmdbId, !favorite))}
          >
            {favorite ? "♥" : "♡"}
          </RowButton>
          <RowButton
            tone="paper"
            aria-label={`Retirer ${title}`}
            disabled={busy}
            onClick={() => act(() => onRemove(tmdbId))}
          >
            ✕
          </RowButton>
        </>
      }
    >
      <RowMeta>{toWatchMeta(movie)}</RowMeta>
      <RowMeta>{wantedLine(movie.wantedBy) ?? addedLine(movie)}</RowMeta>
    </MovieRow>
  );
}
