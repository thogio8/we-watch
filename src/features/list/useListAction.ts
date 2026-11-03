import { leaveIfRefused } from "@/access/refusals";
import { useState } from "react";

export type ListAction = (tmdbId: number) => Promise<void>;

/** Runs a row action; `failed` tells whether the last one threw. */
export function useListAction() {
  const [failed, setFailed] = useState(false);

  const run = async (action: ListAction, tmdbId: number) => {
    setFailed(false);
    try {
      await action(tmdbId);
    } catch (error) {
      leaveIfRefused(error);
      setFailed(true);
    }
  };

  return { failed, run };
}
