import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Journal = { entries: { tag: string }[] };
const readJournal = () =>
  JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as Journal;

/** The tags of drizzle/'s migrations, in journal order. */
export const migrationTags = readJournal().entries.map(({ tag }) => tag);

/** The tag of the migration numbered `number` ("0009"), or "". */
export const migrationTag = (number: string) =>
  migrationTags.find((tag) => tag.startsWith(`${number}_`)) ?? "";

/** The SQL statements of the file at `path`, comments aside. */
export const statementsIn = (path: string) =>
  readFileSync(path, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.startsWith("--"))
        .join(" ")
        .trim(),
    )
    .filter((statement) => statement !== "");

/** The SQL statements of migration `tag`, comments aside. */
export const statementsOf = (tag: string) => statementsIn(`drizzle/${tag}.sql`);

/**
 * A copy of drizzle/ in `dir` whose journal stops after the first `count`
 * migrations: the state of a database before the later ones, as the migrator
 * recorded it. Returns the copy's folder.
 */
export function migrationsUpTo(dir: string, count: number) {
  const folder = join(dir, "drizzle");
  cpSync("drizzle", folder, { recursive: true });
  const journal = readJournal();
  writeFileSync(
    join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }),
  );
  return folder;
}
