import { readFileSync } from "node:fs";

type Journal = { entries: { tag: string }[] };

/** The tags of drizzle/'s migrations, in journal order. */
export const migrationTags = (
  JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as Journal
).entries.map(({ tag }) => tag);

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
