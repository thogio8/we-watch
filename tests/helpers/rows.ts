import { sql } from "drizzle-orm";
import type { Database } from "@/db/create-database";

/** Every row of every table: what a refused or failed write leaves unchanged. */
export async function allRows(
  db: Database,
): Promise<Record<string, unknown[]>> {
  const tables = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );
  const rows: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    rows[name] = await db.all(sql.raw(`SELECT * FROM "${name}"`));
  }
  return rows;
}
