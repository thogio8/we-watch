"use server";

import { assertUnlocked } from "@/access/assert-unlocked";
import { getMoviesRepository } from "@/server/container";
import { revalidateListPages } from "@/server/revalidate";
import { assertTmdbId } from "@/server/validate";

/** « ON LE REGARDE »: the movie is watched today. No-op if it is not « à voir ». */
export async function markWatched(tmdbId: number): Promise<void> {
  await assertUnlocked();
  assertTmdbId("markWatched", tmdbId);
  await getMoviesRepository().apply("mark_watched", tmdbId);
  revalidateListPages();
}
