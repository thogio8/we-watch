import { createDatabase } from "@/db/create-database";
import { createDecisions } from "@/db/decisions";
import { createGroupList } from "@/db/group-list";
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
