import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { aDatabase } from "@tests/helpers/groups";
import {
  migrationTag,
  migrationTags,
  migrationsUpTo,
  statementsOf,
} from "@tests/helpers/migrations";
import { createDatabase } from "./create-database";

// Migration 0012 (2.1.0) runs before the new code, while the 2.0 build still
// serves: it may only add. Older code ignores the columns.

const favorites = migrationTag("0012");

describe("migration des coups de cœur", () => {
  it("vient juste après celle qui rejoue l’ancienne liste", () => {
    expect(migrationTags.indexOf(favorites)).toBe(12);
  });

  it("ne fait qu’ajouter deux colonnes et un index", () => {
    const statements = statementsOf(favorites);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toBe(
      "ALTER TABLE `group_movie` ADD `favorite_at` integer;",
    );
    expect(statements[1]).toMatch(
      /^ALTER TABLE `group_movie` ADD `favorite_by` text REFERENCES/,
    );
    expect(statements[2]).toBe(
      "CREATE INDEX `group_movie_favorite_by_idx` ON `group_movie` (`favorite_by`);",
    );
    expect(statements.join(" ")).not.toMatch(/\b(DROP|PRAGMA)\b|__new_/i);
  });

  it("favorite_by désigne un utilisateur, mis à NULL à sa suppression", async () => {
    const db = await aDatabase();
    const keys = await db.all<{
      from: string;
      table: string;
      on_delete: string;
    }>(
      sql`SELECT "from", "table", on_delete FROM pragma_foreign_key_list('group_movie') WHERE "from" = 'favorite_by'`,
    );
    expect(keys).toEqual([
      { from: "favorite_by", table: "user", on_delete: "SET NULL" },
    ]);
  });

  describe("sur une base 2.0 remplie", () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("chaque ligne reste, sans coup de cœur", async () => {
      dir = mkdtempSync(join(tmpdir(), "ww-favorites-"));
      const url = `file:${join(dir, "app.db")}`;
      const db = createDatabase(url);
      const client = createClient({ url });
      await migrate(db, { migrationsFolder: migrationsUpTo(dir, 12) });
      await client.batch(
        [
          "INSERT INTO user (id, name, email) VALUES ('u-1', 'Léa', 'u-1@x')",
          "INSERT INTO movie_snapshot (tmdb_id, title, overview, vote_average) VALUES (1, 'A', '', 1), (2, 'B', '', 2)",
          "INSERT INTO app_group (id, name, created_at) VALUES ('g', 'G', 1)",
          "INSERT INTO membership (group_id, user_id, joined_at, last_used_at) VALUES ('g', 'u-1', 1, 1)",
          `INSERT INTO group_movie (group_id, tmdb_id, status, decided_at, watched_at, added_by, added_via) VALUES
             ('g', 1, 'to_watch', 5, NULL, 'u-1', 'swipe'),
             ('g', 2, 'watched', 6, 7, 'u-1', 'search')`,
        ],
        "write",
      );

      await migrate(db, { migrationsFolder: "drizzle" });

      const rows = (
        await client.execute(
          "SELECT tmdb_id, status, decided_at, favorite_at, favorite_by FROM group_movie ORDER BY tmdb_id",
        )
      ).rows;
      expect(rows.map((row) => ({ ...row }))).toEqual([
        {
          tmdb_id: 1,
          status: "to_watch",
          decided_at: 5,
          favorite_at: null,
          favorite_by: null,
        },
        {
          tmdb_id: 2,
          status: "watched",
          decided_at: 6,
          favorite_at: null,
          favorite_by: null,
        },
      ]);
      client.close();
    });
  });
});
