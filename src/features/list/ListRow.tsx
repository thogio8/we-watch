"use client";

import { useTransition } from "react";
import type { Movie } from "@/domain/movie";
import { formatShortDate } from "@/domain/time";
import { MovieRow, RowButton, RowMeta } from "./MovieRow";
import { toWatchMeta } from "./toWatchMeta";
import type { ListAction } from "./useListAction";

interface ListRowProps {
  movie: Movie;
  run: (action: ListAction, tmdbId: number) => Promise<void>;
  onRemove: ListAction;
  onUnwatch: ListAction;
}

/** A row with its own pending state, so a double tap cannot act twice. */
export function ListRow({ movie, run, onRemove, onUnwatch }: ListRowProps) {
  const [busy, startTransition] = useTransition();
  const act = (action: ListAction) =>
    startTransition(() => run(action, movie.tmdbId));

  if (movie.status === "watched") {
    // « Vu le JJ/MM » is on the device's clock. These rows are never
    // server-rendered (À VOIR is the default tab), so no time-zone mismatch.
    return (
      <MovieRow
        title={movie.title}
        posterPath={movie.posterPath}
        muted
        busy={busy}
        action={
          <RowButton
            tone="paper"
            aria-label={`Remettre ${movie.title} à voir`}
            disabled={busy}
            onClick={() => act(onUnwatch)}
          >
            ↺ À VOIR
          </RowButton>
        }
      >
        <RowMeta>
          Vu le
          {movie.watchedAt && ` ${formatShortDate(movie.watchedAt)}`}
        </RowMeta>
      </MovieRow>
    );
  }
  return (
    <MovieRow
      title={movie.title}
      posterPath={movie.posterPath}
      busy={busy}
      action={
        <RowButton
          tone="paper"
          aria-label={`Retirer ${movie.title}`}
          disabled={busy}
          onClick={() => act(onRemove)}
        >
          ✕
        </RowButton>
      }
    >
      <RowMeta>{toWatchMeta(movie)}</RowMeta>
    </MovieRow>
  );
}
