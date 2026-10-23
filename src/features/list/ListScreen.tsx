"use client";

import Image from "next/image";
import {
  type KeyboardEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { Movie } from "@/domain/movie";
import { formatRuntime, formatShortDate } from "@/domain/time";
import styles from "./ListScreen.module.css";
import { MovieRow, RowButton, RowMeta } from "./MovieRow";

type ListAction = (tmdbId: number) => Promise<void>;

interface ListScreenProps {
  toWatch: Movie[];
  watched: Movie[];
  onRemove: ListAction;
  onUnwatch: ListAction;
}

type Tab = "toWatch" | "watched";

const TABS: readonly Tab[] = ["toWatch", "watched"];

const TAB_LABELS: Record<Tab, string> = { toWatch: "À VOIR", watched: "VUS" };

const EMPTY: Record<Tab, { title: string; text: string }> = {
  toWatch: {
    title: "RIEN À VOIR POUR L’INSTANT",
    text: "Swipez quelques films pour la remplir",
  },
  watched: {
    title: "AUCUN FILM VU POUR L’INSTANT",
    text: "Les films tirés et regardés atterrissent ici",
  },
};

/** « 2h05 · Netflix »; no platform reads « PAS EN STREAMING ». */
function toWatchMeta(movie: Movie): string {
  const providers =
    movie.providers.length === 0
      ? ["PAS EN STREAMING"]
      : movie.providers.map((p) => p.name);
  return [formatRuntime(movie.runtimeMinutes), ...providers]
    .filter((part) => part !== null)
    .join(" · ");
}

const subscribeNever = () => () => {};

/**
 * True once hydrated. « Vu le JJ/MM » is a date on the device's clock: the
 * server's time zone may differ, so the date is only written on the client.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

interface ListRowProps {
  movie: Movie;
  watchedDate: boolean;
  run: (action: ListAction, tmdbId: number) => Promise<void>;
  onRemove: ListAction;
  onUnwatch: ListAction;
}

/** A row with its own pending state, so a double tap cannot act twice. */
function ListRow({
  movie,
  watchedDate,
  run,
  onRemove,
  onUnwatch,
}: ListRowProps) {
  const [busy, startTransition] = useTransition();
  const act = (action: ListAction) =>
    startTransition(() => run(action, movie.tmdbId));

  if (movie.status === "watched") {
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
          {watchedDate && movie.watchedAt
            ? ` ${formatShortDate(movie.watchedAt)}`
            : null}
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

export function ListScreen({
  toWatch,
  watched,
  onRemove,
  onUnwatch,
}: ListScreenProps) {
  const [tab, setTab] = useState<Tab>("toWatch");
  const [failed, setFailed] = useState(false);
  const isClient = useIsClient();
  const id = useId();
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const movies = { toWatch, watched };
  const shown = movies[tab];

  const run = async (action: ListAction, tmdbId: number) => {
    setFailed(false);
    try {
      await action(tmdbId);
    } catch {
      setFailed(true);
    }
  };

  // Tabs pattern: the arrows move between the two tabs.
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "toWatch" ? "watched" : "toWatch";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <main className={styles.screen}>
      <h1 className={styles.logo}>NOTRE LISTE</h1>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Listes"
        onKeyDown={onTabKey}
      >
        {TABS.map((key) => (
          <button
            key={key}
            ref={(element) => {
              tabRefs.current[key] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-${key}`}
            aria-selected={tab === key}
            aria-controls={`${id}-panel`}
            tabIndex={tab === key ? 0 : -1}
            className={tab === key ? `${styles.tab} ${styles.on}` : styles.tab}
            onClick={() => setTab(key)}
          >
            {`${TAB_LABELS[key]} · ${movies[key].length}`}
          </button>
        ))}
      </div>

      {failed && (
        <p className={styles.alert} role="alert">
          PAS RÉUSSI À ENREGISTRER, RÉESSAIE
        </p>
      )}

      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
        className={styles.panel}
      >
        {shown.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{EMPTY[tab].title}</p>
            <p className={styles.emptyText}>{EMPTY[tab].text}</p>
          </div>
        ) : (
          <ul className={styles.rows}>
            {shown.map((movie) => (
              <ListRow
                key={movie.tmdbId}
                movie={movie}
                watchedDate={isClient}
                run={run}
                onRemove={onRemove}
                onUnwatch={onUnwatch}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className={styles.footer}>
        <a
          className={styles.tmdb}
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* Official logo, unaltered (public/tmdb-logo.svg, from themoviedb.org). */}
          <Image src="/tmdb-logo.svg" alt="TMDB" width={123} height={16} />
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
        <p>
          Disponibilités :{" "}
          <a
            href="https://www.justwatch.com/fr"
            target="_blank"
            rel="noopener noreferrer"
          >
            JustWatch
          </a>
        </p>
      </footer>
    </main>
  );
}

/** Shown while the list loads: the title alone. */
export function ListScreenFallback() {
  return (
    <main className={styles.screen} aria-busy="true">
      <h1 className={styles.logo}>NOTRE LISTE</h1>
    </main>
  );
}
