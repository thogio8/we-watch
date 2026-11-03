"use server";

import { getGroupList } from "@/server/container";
import { assertMember } from "@/server/groups";
import { revalidateListPages } from "@/server/revalidate";
import { assertTmdbId } from "@/server/validate";

/** « ON LE REGARDE »: watched today, by me. No-op if it is not « à voir ». */
export async function markWatched(
  groupId: string,
  tmdbId: number,
): Promise<void> {
  const { user } = await assertMember(groupId);
  assertTmdbId("markWatched", tmdbId);
  await getGroupList().apply({
    groupId,
    userId: user.userId,
    action: "mark_watched",
    tmdbId,
  });
  revalidateListPages();
}
