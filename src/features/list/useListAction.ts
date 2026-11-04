import { leaveIfRefused } from "@/access/refusals";
import { useState } from "react";

export type ListAction = (tmdbId: number) => Promise<unknown>;
export type FavoriteAction = (tmdbId: number, on: boolean) => Promise<unknown>;

/** Runs a row action; `failed` tells whether the last one threw. */
export function useListAction() {
  const [failed, setFailed] = useState(false);

  const run = async (task: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await task();
    } catch (error) {
      leaveIfRefused(error);
      setFailed(true);
    }
  };

  return { failed, run };
}
