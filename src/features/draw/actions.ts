"use server";

import { assertUnlocked } from "@/access/assert-unlocked";
import { revalidatePath } from "next/cache";
import { getMoviesRepository } from "@/server/container";
import { assertTmdbId } from "@/server/validate";

/** « ON LE REGARDE »: the movie is watched today. No-op if it is not « à voir ». */
export async function markWatched(tmdbId: number): Promise<void> {
  await assertUnlocked();
  assertTmdbId("markWatched", tmdbId);
  await getMoviesRepository().apply("mark_watched", tmdbId);
  revalidatePath("/", "layout");
}
