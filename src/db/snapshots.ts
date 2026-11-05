import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import type { MovieSnapshot } from "@/domain/movie";
import type { ApplyResult } from "@/domain/transitions";
import type { Database, Executor } from "./create-database";
import { groupMovie, movieSnapshot } from "./group-schema";

export interface Snapshots {
  /** Saves the TMDB data of a movie, replacing what was known. */
  upsert(snapshot: MovieSnapshot): Promise<void>;
  /** New TMDB data for a known movie only ("noop" if absent). */
  refresh(snapshot: MovieSnapshot): Promise<ApplyResult>;
  /** The stored data of a movie « à voir » or « vu » in this group, else null. */
  getListed(groupId: string, tmdbId: number): Promise<MovieSnapshot | null>;
  /** Movies to watch or watched in at least one group (cron). */
  listedIds(): Promise<number[]>;
}

/** Shared by the writes that bring a movie into a list. */
export async function upsertSnapshot(
  db: Executor,
  snapshot: MovieSnapshot,
): Promise<void> {
  await db
    .insert(movieSnapshot)
    .values(snapshot)
    .onConflictDoUpdate({ target: movieSnapshot.tmdbId, set: snapshot });
}

export function createSnapshots(db: Database): Snapshots {
  return {
    upsert: (snapshot) => upsertSnapshot(db, snapshot),

    async refresh(snapshot) {
      const updated = await db
        .update(movieSnapshot)
        .set(snapshot)
        .where(eq(movieSnapshot.tmdbId, snapshot.tmdbId))
        .returning({ id: movieSnapshot.tmdbId });
      return updated.length > 0 ? "applied" : "noop";
    },

    async getListed(groupId, tmdbId) {
      const [row] = await db
        .select(getTableColumns(movieSnapshot))
        .from(movieSnapshot)
        .innerJoin(groupMovie, eq(groupMovie.tmdbId, movieSnapshot.tmdbId))
        .where(
          and(
            eq(groupMovie.groupId, groupId),
            eq(movieSnapshot.tmdbId, tmdbId),
            inArray(groupMovie.status, ["to_watch", "watched"]),
          ),
        );
      return row ?? null;
    },

    async listedIds() {
      const rows = await db
        .selectDistinct({ id: groupMovie.tmdbId })
        .from(groupMovie)
        .where(inArray(groupMovie.status, ["to_watch", "watched"]));
      return rows.map((r) => r.id);
    },
  };
}
