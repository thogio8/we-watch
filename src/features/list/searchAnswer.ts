import type { MovieStatus } from "@/domain/movie";
import type { SearchOutcome } from "./actions";

/** The search itself threw (not a TMDB outage, which comes back as ok: false). */
export interface Crashed {
  ok: false;
  crashed: true;
}

export const CRASHED: Crashed = { ok: false, crashed: true };

/** The last answer, and the (trimmed) query it answers. */
export interface Answer {
  query: string;
  outcome: SearchOutcome | Crashed;
}

/** Searching a rejected movie on purpose means we changed our minds. */
export const canAdd = (status: MovieStatus | null) =>
  status === null || status === "rejected";

/** The answer still shows an older query's results. */
export const isStale = (answer: Answer | null, query: string) =>
  answer !== null && answer.query !== query;

/** The added movie's row flips to « À VOIR » at once. */
export function markAdded(
  answer: Answer | null,
  tmdbId: number,
): Answer | null {
  if (!answer?.outcome.ok) return answer;
  return {
    ...answer,
    outcome: {
      ok: true,
      results: answer.outcome.results.map((r) =>
        r.tmdbId === tmdbId ? { ...r, status: "to_watch" as const } : r,
      ),
    },
  };
}
