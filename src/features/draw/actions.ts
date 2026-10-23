"use server";

import { assertUnlocked } from "@/access/assert-unlocked";
import { revalidatePath } from "next/cache";
import { getMoviesRepository } from "@/server/container";

/** « ON LE REGARDE »: the movie is watched today. No-op if it is not « à voir ». */
export async function markWatched(tmdbId: number): Promise<void> {
  await assertUnlocked();
  // Server Actions are public endpoints: never trust the argument's type.
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    throw new Error(`markWatched: invalid tmdbId ${String(tmdbId)}`);
  }
  await getMoviesRepository().apply("mark_watched", tmdbId);
  revalidatePath("/", "layout");
}
