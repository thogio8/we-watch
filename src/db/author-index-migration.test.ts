import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aDatabase } from "@tests/helpers/groups";
import {
  migrationTag,
  migrationTags,
  statementsOf,
} from "@tests/helpers/migrations";

// Migration 0009 (2.0, piece 5) runs before the new code, while the previous
// build still serves: it may only add. Its indexes keep account deletion
// from scanning every list for the deleted member's rows.

const indexes = migrationTag("0009");

describe("migration des index d’auteurs", () => {
  it("vient juste après celle des liens d’invitation", () => {
    expect(migrationTags.length).toBeGreaterThanOrEqual(10);
    expect(migrationTags.indexOf(indexes)).toBe(9);
  });

  it("ne fait qu’ajouter trois index", () => {
    expect(statementsOf(indexes)).toEqual([
      "CREATE INDEX `group_movie_added_by_idx` ON `group_movie` (`added_by`);",
      "CREATE INDEX `group_movie_watched_by_idx` ON `group_movie` (`watched_by`);",
      "CREATE INDEX `movie_want_user_id_idx` ON `movie_want` (`user_id`);",
    ]);
  });

  it("les index existent une fois la base migrée", async () => {
    const db = await aDatabase();
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('group_movie_added_by_idx', 'group_movie_watched_by_idx', 'movie_want_user_id_idx') ORDER BY name`,
    );

    expect(rows.map(({ name }) => name)).toEqual([
      "group_movie_added_by_idx",
      "group_movie_watched_by_idx",
      "movie_want_user_id_idx",
    ]);
  });
});
