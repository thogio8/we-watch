import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aDatabase, aGroup } from "@tests/helpers/groups";
import { group } from "./group-schema";

// Migration 0008 (2.0, piece 3) runs before the new code, while 1.3.x or the
// previous 2.0 build still serves: it may only add.

type Journal = { entries: { tag: string }[] };
const { entries } = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
) as Journal;
const invites = entries.find(({ tag }) => /^0008_/.test(tag))?.tag ?? "";

const statements = readFileSync(`drizzle/${invites}.sql`, "utf8")
  .split("--> statement-breakpoint")
  .map((statement) =>
    statement
      .split("\n")
      .filter((line) => !line.startsWith("--"))
      .join(" ")
      .trim(),
  )
  .filter((statement) => statement !== "");

describe("migration des liens d’invitation", () => {
  it("vient juste après celles des groupes", () => {
    // Later versions add theirs after it.
    expect(entries.length).toBeGreaterThanOrEqual(9);
    expect(invites).toMatch(/^0008_/);
    expect(entries.map(({ tag }) => tag).indexOf(invites)).toBe(8);
  });

  it("ne fait qu’ajouter : une colonne nullable et son index unique", () => {
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(
      /^ALTER TABLE `app_group` ADD `invite_token` text;$/,
    );
    expect(statements[1]).toMatch(
      /^CREATE UNIQUE INDEX `app_group_invite_token_unique` ON `app_group` \(`invite_token`\);$/,
    );
  });

  it("refuse deux groupes avec le même jeton, accepte plusieurs groupes sans jeton", async () => {
    const db = await aDatabase();
    const a = await aGroup(db, "A", []);
    const b = await aGroup(db, "B", []);

    await db.update(group).set({ inviteToken: "t" }).where(eq(group.id, a));

    await expect(
      db.update(group).set({ inviteToken: "t" }).where(eq(group.id, b)),
    ).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/UNIQUE/) },
    });
  });
});
