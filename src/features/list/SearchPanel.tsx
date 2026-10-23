"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { MovieStatus } from "@/domain/movie";
import { movieMeta } from "@/ui/movieMeta";
import { ProviderTags } from "@/ui/ProviderTags";
import type { SearchOutcome, SearchResult } from "./actions";
import {
  ListAlert,
  ListMessage,
  MovieRow,
  RowButton,
  RowDone,
  RowList,
  RowMeta,
} from "./MovieRow";
import styles from "./SearchPanel.module.css";

export interface SearchActions {
  search: (query: string) => Promise<SearchOutcome>;
  add: (tmdbId: number) => Promise<void>;
}

interface SearchPanelProps extends SearchActions {
  /** The list, shown while the query is blank. */
  children: ReactNode;
}

/** The last answer, and the (trimmed) query it answers. */
interface Answer {
  query: string;
  outcome: SearchOutcome | Crashed;
}

/** The search itself threw (not a TMDB outage, which comes back as ok: false). */
interface Crashed {
  ok: false;
  crashed: true;
}

const DEBOUNCE_MS = 300;

/** Same cap as the server action. */
const MAX_QUERY_LENGTH = 100;

/** Searching a rejected movie on purpose means we changed our minds. */
const canAdd = (status: MovieStatus | null) =>
  status === null || status === "rejected";

function ResultRow({
  result,
  onAdd,
}: {
  result: SearchResult;
  onAdd: (tmdbId: number) => Promise<void>;
}) {
  const [busy, startTransition] = useTransition();
  return (
    <MovieRow
      title={result.title}
      posterPath={result.posterPath}
      busy={busy}
      action={
        canAdd(result.status) ? (
          <RowButton
            tone="yellow"
            aria-label={`Ajouter ${result.title}`}
            disabled={busy}
            onClick={() => startTransition(() => onAdd(result.tmdbId))}
          >
            + AJOUTER
          </RowButton>
        ) : (
          <RowDone>{result.status === "watched" ? "✓ VU" : "✓ À VOIR"}</RowDone>
        )
      }
    >
      <RowMeta>{movieMeta(result)}</RowMeta>
      <ProviderTags providers={result.providers} />
    </MovieRow>
  );
}

function Results({
  answer,
  stale,
  onAdd,
}: {
  answer: Answer | null;
  stale: boolean;
  onAdd: (tmdbId: number) => Promise<void>;
}) {
  if (answer === null) {
    return <ListMessage title="ON CHERCHE…" live />;
  }
  if (!answer.outcome.ok) {
    if ("crashed" in answer.outcome) {
      return <ListMessage title="LA RECHERCHE A ÉCHOUÉ, RÉESSAIE" live />;
    }
    return <ListMessage title="TMDB NE RÉPOND PAS, RÉESSAIE" live />;
  }
  if (answer.outcome.results.length === 0) {
    return <ListMessage title={`RIEN TROUVÉ POUR « ${answer.query} »`} live />;
  }
  return (
    <RowList busy={stale}>
      {answer.outcome.results.map((result) => (
        <ResultRow key={result.tmdbId} result={result} onAdd={onAdd} />
      ))}
    </RowList>
  );
}

/**
 * « AJOUTER UN FILM… »: a TMDB search whose results replace the list while
 * the query is not blank (mockup screens 5′ and 7).
 */
export function SearchPanel({ search, add, children }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [addFailed, setAddFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  // Debounced search. An answer only lands if its query is still the field's:
  // typing again cancels the timer and drops the in-flight answer.
  useEffect(() => {
    if (trimmed === "") return;
    let current = true;
    const timer = setTimeout(() => {
      search(trimmed)
        .catch((): Crashed => ({ ok: false, crashed: true }))
        .then((outcome) => {
          if (current) setAnswer({ query: trimmed, outcome });
        });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [trimmed, search]);

  const changeQuery = (next: string) => {
    setQuery(next);
    setAddFailed(false);
    // A new search starts from scratch, not from the last one's results.
    if (next.trim() === "") setAnswer(null);
  };

  const clear = () => {
    changeQuery("");
    inputRef.current?.focus();
  };

  const onAdd = async (tmdbId: number) => {
    setAddFailed(false);
    try {
      await add(tmdbId);
    } catch {
      setAddFailed(true);
      return;
    }
    // The row flips at once; the list itself is refreshed by the action.
    setAnswer((previous) =>
      previous?.outcome.ok
        ? {
            ...previous,
            outcome: {
              ok: true,
              results: previous.outcome.results.map((r) =>
                r.tmdbId === tmdbId ? { ...r, status: "to_watch" } : r,
              ),
            },
          }
        : previous,
    );
  };

  return (
    <>
      <div className={styles.search}>
        <span className={styles.icon} aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          aria-label="Ajouter un film"
          placeholder="AJOUTER UN FILM…"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={MAX_QUERY_LENGTH}
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            changeQuery(event.target.value)
          }
        />
        {query !== "" && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Effacer la recherche"
            onClick={clear}
          >
            ✕
          </button>
        )}
      </div>

      {trimmed === "" ? (
        children
      ) : (
        <section aria-label="Résultats TMDB">
          <p className={styles.label} aria-hidden="true">
            Résultats TMDB
          </p>
          {addFailed && <ListAlert>PAS RÉUSSI À AJOUTER, RÉESSAIE</ListAlert>}
          <Results
            answer={answer}
            stale={answer !== null && answer.query !== trimmed}
            onAdd={onAdd}
          />
        </section>
      )}
    </>
  );
}
