import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aDatabase } from "@tests/helpers/groups";
import {
  migrationTag,
  migrationTags,
  statementsOf,
} from "@tests/helpers/migrations";

// Migration 0010 (2.0, piece 6) runs before the new code, while the previous
// build still serves: it may only add. Its table counts sign-in and other
// attempts (src/db/rate-limit.ts).

const limits = migrationTag("0010");

describe("migration des limites de tentatives", () => {
  it("vient juste après celle des index d’auteurs", () => {
    expect(migrationTags.length).toBeGreaterThanOrEqual(11);
    expect(migrationTags.indexOf(limits)).toBe(10);
  });

  it("ne fait qu’ajouter une table", () => {
    const statements = statementsOf(limits);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^CREATE TABLE `rate_limit` \(/);
    expect(statements.join(" ")).not.toMatch(/\b(ALTER|DROP)\b/i);
  });

  it("la table existe une fois la base migrée", async () => {
    const db = await aDatabase();
    const columns = await db.all<{ name: string; pk: number }>(
      sql`SELECT name, pk FROM pragma_table_info('rate_limit') ORDER BY cid`,
    );

    expect(columns).toEqual([
      { name: "key", pk: 1 },
      { name: "count", pk: 0 },
      { name: "window_start", pk: 0 },
    ]);
  });
});
