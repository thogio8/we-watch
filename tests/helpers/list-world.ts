import { and, eq } from "drizzle-orm";
import { createDatabase, type Database } from "@/db/create-database";
import { createDecisions } from "@/db/decisions";
import { createGroupList } from "@/db/group-list";
import { groupMovie } from "@/db/group-schema";
import { aDatabase, aGroup, aUser } from "./groups";

/** A migrated database with Léa and Hugo in group A, Léa alone in group B. */
export async function aListWorld() {
  const db: ReturnType<typeof createDatabase> = await aDatabase();
  const lea = await aUser(db, "Léa");
  const hugo = await aUser(db, "Hugo");
  return {
    db,
    list: createGroupList(db),
    decisions: createDecisions(db),
    lea,
    hugo,
    groupA: await aGroup(db, "A", [lea, hugo]),
    groupB: await aGroup(db, "B", [lea]),
  };
}

/** The match columns of a movie's row, whatever its status; null: no row. */
export async function matchOf(db: Database, groupId: string, tmdbId: number) {
  const [row] = await db
    .select({ at: groupMovie.matchedAt, by: groupMovie.matchedBy })
    .from(groupMovie)
    .where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)));
  return row ?? null;
}
