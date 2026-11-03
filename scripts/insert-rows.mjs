// Inserts saved rows back into a table (scripts/restore-db.mjs), on the
// columns both the rows and the current schema have: an absent column takes
// its default, an unknown one is ignored and named on stderr (its name, never
// a value).

/** A SQL identifier, quoted. */
export const quote = (name) => `"${name.replaceAll('"', '""')}"`;

/**
 * One insert per row. `table` comes from the scripts' own lists, never from
 * a file.
 * @param {Pick<import("@libsql/client").Client, "execute">} db
 * @param {string} table
 * @param {Record<string, unknown>[]} rows
 * @returns {Promise<import("@libsql/client").InStatement[]>}
 */
export async function insertsInto(db, table, rows) {
  const { rows: schema } = await db.execute({
    sql: "select name from pragma_table_info(?)",
    args: [table],
  });
  const known = new Set(schema.map(({ name }) => String(name)));
  const saved = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const ignored = saved.filter((name) => !known.has(name));
  if (ignored.length > 0) {
    console.error(`${table}: colonne ignorée ${ignored.join(", ")}`);
  }
  const kept = saved.filter((name) => known.has(name));
  const sql = `insert into ${quote(table)} (${kept.map(quote).join(", ")}) values (${kept.map(() => "?").join(", ")})`;
  return rows.map((row) => ({
    sql,
    args: kept.map((name) => row[name] ?? null),
  }));
}
