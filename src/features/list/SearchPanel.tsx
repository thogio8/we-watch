"use client";

import { leaveIfSignedOut } from "@/access/signed-out";
import { type ReactNode, useState } from "react";
import type { SearchOutcome } from "./actions";
import { ListAlert } from "./MovieRow";
import { isStale, markAdded } from "./searchAnswer";
import { SearchField } from "./SearchField";
import styles from "./SearchPanel.module.css";
import { SearchResults } from "./SearchResults";
import { useDebouncedSearch } from "./useDebouncedSearch";

export interface SearchActions {
  search: (query: string) => Promise<SearchOutcome>;
  add: (tmdbId: number) => Promise<void>;
}

interface SearchPanelProps extends SearchActions {
  /** The list, shown while the query is blank. */
  children: ReactNode;
}

/**
 * « AJOUTER UN FILM… »: a TMDB search whose results replace the list while
 * the query is not blank (mockup screens 5′ and 7).
 */
export function SearchPanel({ search, add, children }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [addFailed, setAddFailed] = useState(false);
  const trimmed = query.trim();
  const [answer, setAnswer] = useDebouncedSearch(search, trimmed);

  const changeQuery = (next: string) => {
    setQuery(next);
    setAddFailed(false);
    // A new search starts from scratch, not from the last one's results.
    if (next.trim() === "") setAnswer(null);
  };

  const onAdd = async (tmdbId: number) => {
    setAddFailed(false);
    try {
      await add(tmdbId);
    } catch (error) {
      leaveIfSignedOut(error);
      setAddFailed(true);
      return;
    }
    // The row flips at once; the list itself is refreshed by the action.
    setAnswer((previous) => markAdded(previous, tmdbId));
  };

  return (
    <>
      <SearchField value={query} onChange={changeQuery} />

      {trimmed === "" ? (
        children
      ) : (
        <section aria-label="Résultats TMDB">
          <p className={styles.label} aria-hidden="true">
            Résultats TMDB
          </p>
          {addFailed && <ListAlert>PAS RÉUSSI À AJOUTER, RÉESSAIE</ListAlert>}
          <SearchResults
            answer={answer}
            stale={isStale(answer, trimmed)}
            onAdd={onAdd}
          />
        </section>
      )}
    </>
  );
}
