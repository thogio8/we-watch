import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import {
  migrationTag,
  migrationTags,
  migrationsUpTo,
  statementsOf,
} from "@tests/helpers/migrations";
import { aDatabase } from "@tests/helpers/groups";
import { createDatabase } from "./create-database";

// Migration 0014 (2.2.0) runs before the new code, while the 2.1 build still
// serves: it may only add. Older code ignores the columns.

const match = migrationTag("0014");

describe("migration des matches", () => {
  it("vient juste après celle qui retire les restes d’avant les comptes", () => {
    expect(migrationTags.indexOf(match)).toBe(14);
  });

  it("ne fait qu’ajouter deux colonnes", () => {
    const statements = statementsOf(match);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe(
      "ALTER TABLE `group_movie` ADD `matched_at` integer;",
    );
    expect(statements[1]).toMatch(
      /^ALTER TABLE `group_movie` ADD `matched_by` text REFERENCES `user`\(`id`\) ON UPDATE no action ON DELETE set null;$/,
    );
    expect(statements.join(" ")).not.toMatch(/\b(DROP|PRAGMA)\b|__new_/i);
  });

  it("supprimer l’utilisateur de matched_by le met à NULL (clé étrangère ON DELETE set null)", async () => {
    const db = await aDatabase();
    const keys = await db.all<{
      from: string;
      table: string;
      on_delete: string;
    }>(
      sql`SELECT "from", "table", on_delete FROM pragma_foreign_key_list('group_movie') WHERE "from" = 'matched_by'`,
    );
    expect(keys).toEqual([
      { from: "matched_by", table: "user", on_delete: "SET NULL" },
    ]);
  });

  describe("sur une base 2.1 remplie", () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("0014 ajoute matched_at et matched_by, nulles, sans toucher les lignes existantes", async () => {
      dir = mkdtempSync(join(tmpdir(), "ww-match-"));
      const url = `file:${join(dir, "app.db")}`;
      const db = createDatabase(url);
      const client = createClient({ url });
      await migrate(db, { migrationsFolder: migrationsUpTo(dir, 14) });
      await client.batch(
        [
          "INSERT INTO user (id, name, email) VALUES ('u-1', 'Léa', 'u-1@x')",
          "INSERT INTO movie_snapshot (tmdb_id, title, overview, vote_average) VALUES (1, 'A', '', 1), (2, 'B', '', 2)",
          "INSERT INTO app_group (id, name, created_at) VALUES ('g', 'G', 1)",
          "INSERT INTO membership (group_id, user_id, joined_at, last_used_at) VALUES ('g', 'u-1', 1, 1)",
          `INSERT INTO group_movie (group_id, tmdb_id, status, decided_at, watched_at, added_by, added_via, favorite_at, favorite_by) VALUES
             ('g', 1, 'to_watch', 5, NULL, 'u-1', 'swipe', 8, 'u-1'),
             ('g', 2, 'watched', 6, 7, 'u-1', 'search', NULL, NULL)`,
        ],
        "write",
      );

      await migrate(db, { migrationsFolder: "drizzle" });

      const rows = (
        await client.execute(
          "SELECT tmdb_id, status, decided_at, favorite_at, matched_at, matched_by FROM group_movie ORDER BY tmdb_id",
        )
      ).rows;
      expect(rows.map((row) => ({ ...row }))).toEqual([
        {
          tmdb_id: 1,
          status: "to_watch",
          decided_at: 5,
          favorite_at: 8,
          matched_at: null,
          matched_by: null,
        },
        {
          tmdb_id: 2,
          status: "watched",
          decided_at: 6,
          favorite_at: null,
          matched_at: null,
          matched_by: null,
        },
      ]);
      client.close();
    });
  });
});
