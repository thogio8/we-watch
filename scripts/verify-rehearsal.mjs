// Checks a rehearsed database (scripts/rehearse-migration.mjs): what the
// 2.0 migrations made of `movies` against `movies` itself, which they never
// change. Counts only, never a title nor a date.

/** The single number `sql` selects. */
export const count = async (db, sql) =>
  Number(Object.values((await db.execute(sql)).rows[0])[0]);

const LEGACY = "'nous-deux'";

/** "rejected=2, to_watch=1" for the rows of `from`. */
async function statuses(db, from) {
  const { rows } = await db.execute(
    `select status, count(*) as n from ${from} group by status order by status`,
  );
  return rows.map(({ status, n }) => `${status}=${n}`).join(", ");
}

/**
 * Compares what the 2.0 migrations made of `movies` with `movies` itself.
 * @param {import("@libsql/client").Client} db
 * @returns {Promise<{ report: string[], failures: string[] }>}
 */
export async function verify(db) {
  const report = [];
  const failures = [];
  const check = (label, expected, received) => {
    report.push(`${label}: ${received}`);
    if (expected !== received)
      failures.push(`${label} : attendu ${expected}, reçu ${received}`);
  };
  const movies = await count(db, "select count(*) from movies");
  const inGroup = `group_movie where group_id = ${LEGACY}`;
  report.push(`movies: ${movies}`);
  check(
    "app_group",
    movies > 0 ? 1 : 0,
    await count(db, "select count(*) from app_group"),
  );
  check(
    "nous-deux",
    movies,
    await count(db, `select count(*) from ${inGroup}`),
  );
  check(
    "movie_snapshot",
    await count(db, "select count(distinct tmdb_id) from movies"),
    await count(db, "select count(*) from movie_snapshot"),
  );
  check("statuts", await statuses(db, "movies"), await statuses(db, inGroup));
  check(
    "films sans leur copie exacte",
    0,
    await count(
      db,
      `select count(*) from movies m where not exists (select 1 from ${inGroup}
        and tmdb_id = m.tmdb_id and status = m.status and decided_at = m.decided_at
        and watched_at is m.watched_at)`,
    ),
  );
  check(
    "watched_legacy",
    await count(db, "select count(*) from movies where watched_at is not null"),
    await count(db, `select count(*) from ${inGroup} and watched_legacy = 1`),
  );
  check("membership", 0, await count(db, "select count(*) from membership"));
  const orphans = (await db.execute("pragma foreign_key_check")).rows.length;
  check(
    "foreign_key_check",
    "ok",
    orphans === 0 ? "ok" : `${orphans} ligne(s) orpheline(s)`,
  );
  const integrity = (await db.execute("pragma integrity_check")).rows;
  check(
    "integrity_check",
    "ok",
    integrity.map((row) => Object.values(row)[0]).join("; "),
  );
  return { report, failures };
}
