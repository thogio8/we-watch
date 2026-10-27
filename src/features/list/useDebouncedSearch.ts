import { useEffect, useState } from "react";
import type { SearchOutcome } from "./actions";
import { type Answer, CRASHED } from "./searchAnswer";

const DEBOUNCE_MS = 300;

/**
 * Debounced search. An answer only lands if its query is still the field's:
 * typing again cancels the timer and drops the in-flight answer.
 */
export function useDebouncedSearch(
  search: (query: string) => Promise<SearchOutcome>,
  query: string,
) {
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (query === "") return;
    let current = true;
    const timer = setTimeout(() => {
      search(query)
        .catch(() => CRASHED)
        .then((outcome) => {
          if (current) setAnswer({ query, outcome });
        });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, search]);

  return [answer, setAnswer] as const;
}
