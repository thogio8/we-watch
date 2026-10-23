"use server";

import { revalidatePath } from "next/cache";
import type { MovieAction } from "@/domain/transitions";
import { getMoviesRepository } from "@/server/container";

const isPositiveInt = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

async function applyFromList(
  action: MovieAction,
  tmdbId: number,
): Promise<void> {
  // Server Actions are public endpoints: never trust the argument's type.
  if (!isPositiveInt(tmdbId)) {
    throw new Error(`${action}: invalid tmdbId ${String(tmdbId)}`);
  }
  await getMoviesRepository().apply(action, tmdbId);
  // R10: re-renders the current page, /list, which only reads the database.
  // TIRER is dynamic (connection()), so switching tabs already shows the change.
  revalidatePath("/list");
}

/** ✕ on « à voir »: the movie becomes « refusé », so it never comes back to the swipe. */
export async function removeFromList(tmdbId: number): Promise<void> {
  await applyFromList("remove", tmdbId);
}

/** ↺ À VOIR on « vus »: back to « à voir », `watched_at` cleared. */
export async function unwatch(tmdbId: number): Promise<void> {
  await applyFromList("unwatch", tmdbId);
}
