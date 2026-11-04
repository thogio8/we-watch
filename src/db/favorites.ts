import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { ApplyResult } from "@/domain/transitions";
import type { Database } from "./create-database";
import { groupMovie } from "./group-schema";
import { changed, listRow } from "./list-queries";

interface FavoriteInput {
  groupId: string;
  userId: string;
  tmdbId: number;
  /** The wanted state, not a toggle: two devices never cancel each other. */
  on: boolean;
  now?: Date;
}

export interface Favorites {
  /**
   * One conditional statement each way, never a read then a write.
   * Marking: only a movie still to watch, not already a favourite (the first
   * author and date stay). Unmarking: any leftover columns go.
   */
  set(input: FavoriteInput): Promise<ApplyResult>;
}

export function createFavorites(db: Database): Favorites {
  return {
    async set({ groupId, userId, tmdbId, on, now }) {
      const row = listRow(groupId, tmdbId);
      const written = on
        ? db
            .update(groupMovie)
            .set({ favoriteAt: now ?? new Date(), favoriteBy: userId })
            .where(
              and(
                row,
                eq(groupMovie.status, "to_watch"),
                isNull(groupMovie.favoriteAt),
              ),
            )
        : db
            .update(groupMovie)
            .set({ favoriteAt: null, favoriteBy: null })
            .where(and(row, isNotNull(groupMovie.favoriteAt)));
      return changed(await written.returning({ id: groupMovie.tmdbId }));
    },
  };
}
