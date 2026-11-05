// The tables a backup holds (scripts/backup-db.mjs) and a restore writes
// back (scripts/restore-db.mjs), in the order a restore inserts them:
// every row's foreign keys point to tables listed before it.
// readTables reads them for a backup.

/**
 * What a restore needs, in restore order, with the columns read (`*`: all).
 * Never saved: `session`, `verification` (live credentials, worthless after
 * a restore: everyone signs in again with a passkey), `signup_ticket_use`
 * and `rate_limit` (minutes-long bookkeeping). `account` is read without
 * its secrets (access_token, refresh_token, id_token, password): they never
 * leave the database. `passkey` holds public keys only.
 */
export const TABLES = {
  user: "*",
  passkey: "*",
  account: [
    "id",
    "account_id",
    "provider_id",
    "user_id",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "created_at",
    "updated_at",
  ],
  movie_snapshot: "*",
  app_group: "*",
  membership: "*",
  group_movie: "*",
  movie_want: "*",
  movie_rejection: "*",
};

/**
 * Tables the schema dropped (spec v2 §17) that older backups still hold:
 * a restore skips them, so a backup kept 90 days still restores.
 */
export const DROPPED_TABLES = ["movies"];

const columns = (list) =>
  list === "*" ? "*" : list.map((name) => `"${name}"`).join(", ");

/**
 * Reads the tables of TABLES the database has, from one snapshot: every
 * select in a single read-mode batch (one transaction, one round trip), so a
 * write racing the backup is either wholly in it or wholly out. The table
 * lookup may run apart: the schema does not change during a backup (the
 * release job migrates after it).
 * @param {import("@libsql/client").Client} client
 * @returns {Promise<{ backup: Record<string, unknown[]>, report: string[] }>}
 */
export async function readTables(client) {
  const names = Object.keys(TABLES);
  const { rows: found } = await client.execute({
    sql: `select name from sqlite_master where type = 'table' and name in (${names.map(() => "?").join(", ")})`,
    args: names,
  });
  const existing = new Set(found.map(({ name }) => name));
  const present = names.filter((table) => existing.has(table));
  // Names come from TABLES above, never from the outside.
  const results =
    present.length === 0
      ? []
      : await client.batch(
          present.map(
            (table) => `select ${columns(TABLES[table])} from "${table}"`,
          ),
          "read",
        );
  const backup = {};
  const report = [];
  for (const table of names) {
    const index = present.indexOf(table);
    if (index === -1) {
      report.push(`${table}: absent`);
      continue;
    }
    backup[table] = results[index].rows;
    report.push(`${table}: ${backup[table].length} rows`);
  }
  return { backup, report };
}
