"use client";

import { useTransition } from "react";
import { movieMeta } from "@/ui/movieMeta";
import { ProviderTags } from "@/ui/ProviderTags";
import type { SearchResult } from "./actions";
import {
  ListMessage,
  MovieRow,
  RowButton,
  RowDone,
  RowList,
  RowMeta,
} from "./MovieRow";
import { type Answer, canAdd } from "./searchAnswer";

type Add = (tmdbId: number) => Promise<void>;

function ResultRow({ result, onAdd }: { result: SearchResult; onAdd: Add }) {
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

interface SearchResultsProps {
  answer: Answer | null;
  stale: boolean;
  onAdd: Add;
}

/** The answer's rows, or the message standing in for them. */
export function SearchResults({ answer, stale, onAdd }: SearchResultsProps) {
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
