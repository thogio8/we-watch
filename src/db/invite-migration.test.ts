import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aDatabase, aGroup } from "@tests/helpers/groups";
import {
  migrationTag,
  migrationTags,
  statementsOf,
} from "@tests/helpers/migrations";
import { group } from "./group-schema";

// Migration 0008 (2.0, piece 3) runs before the new code, while 1.3.x or the
// previous 2.0 build still serves: it may only add.

const invites = migrationTag("0008");
const statements = statementsOf(invites);

describe("migration des liens d’invitation", () => {
  it("vient juste après celles des groupes", () => {
    // Later versions add theirs after it.
    expect(migrationTags.length).toBeGreaterThanOrEqual(9);
    expect(invites).toMatch(/^0008_/);
    expect(migrationTags.indexOf(invites)).toBe(8);
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
