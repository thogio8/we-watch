import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";
import { LEGACY_GROUP_ID } from "@/domain/group";
import { aDatabase, aGroup, aUser } from "../../tests/helpers/groups";
import { joinGroupInSignup, signupJoins } from "./group-join";
import { trackTransactions } from "./signup-transaction";

const NOW = new Date("2026-10-30T20:00:00.000Z");

describe("signupJoins", () => {
  it.each([
    ["ni code ni invitation", { owner: false, invite: null }, []],
    [
      "le code seul",
      { owner: true, invite: null },
      [{ groupId: LEGACY_GROUP_ID, lastUsedAt: NOW }],
    ],
    [
      "une invitation seule",
      { owner: false, invite: "g-5" },
      [{ groupId: "g-5", lastUsedAt: NOW }],
    ],
    [
      "le code et une invitation : le groupe de l’invitation est affiché",
      { owner: true, invite: "g-5" },
      [
        { groupId: "g-5", lastUsedAt: NOW },
        { groupId: LEGACY_GROUP_ID, lastUsedAt: null },
      ],
    ],
    [
      "le code et une invitation vers « NOUS DEUX » : une seule appartenance",
      { owner: true, invite: LEGACY_GROUP_ID },
      [{ groupId: LEGACY_GROUP_ID, lastUsedAt: NOW }],
    ],
  ])("%s", (_label, ticket, expected) => {
    expect(signupJoins(ticket, NOW)).toEqual(expected);
  });
});

describe("joinGroupInSignup", () => {
  let db: Database;
  let tracked: Database;
  let userId: string;
  beforeEach(async () => {
    db = await aDatabase();
    tracked = trackTransactions(db);
    userId = await aUser(db, "Léa");
  });

  const members = () => db.select().from(membership);
  const inSignup = (groupId: string, lastUsedAt: Date | null = NOW) =>
    tracked.transaction(() =>
      joinGroupInSignup(userId, { groupId, lastUsedAt }, NOW),
    );

  it("rejoint un groupe existant, dans la transaction de l’inscription", async () => {
    const groupId = await aGroup(db, "LA COLOC", []);

    await inSignup(groupId);

    expect(await members()).toEqual([
      { groupId, userId, joinedAt: NOW, lastUsedAt: NOW },
    ]);
  });

  it("garde un groupe jamais affiché (lastUsedAt nul)", async () => {
    const groupId = await aGroup(db, "NOUS DEUX", []);

    await inSignup(groupId, null);

    expect(await members()).toEqual([
      { groupId, userId, joinedAt: NOW, lastUsedAt: null },
    ]);
  });

  it("un groupe supprimé : aucune appartenance, et l’inscription continue", async () => {
    await inSignup("groupe-disparu");

    expect(await members()).toEqual([]);
    expect(await db.select().from(group)).toEqual([]);
  });

  it("déjà membre : rien ne change, sans erreur", async () => {
    const groupId = await aGroup(db, "LA COLOC", [userId]);
    const before = await members();

    await inSignup(groupId);

    expect(await members()).toEqual(before);
  });

  it("une inscription qui échoue ensuite annule l’appartenance", async () => {
    const groupId = await aGroup(db, "LA COLOC", []);

    await expect(
      tracked.transaction(async () => {
        await joinGroupInSignup(userId, { groupId, lastUsedAt: NOW }, NOW);
        throw new Error("passkey already registered");
      }),
    ).rejects.toThrow("passkey already registered");

    expect(await members()).toEqual([]);
  });

  it("hors d’une transaction de Better Auth : refuse d’écrire", async () => {
    const groupId = await aGroup(db, "LA COLOC", []);

    await expect(
      joinGroupInSignup(userId, { groupId, lastUsedAt: NOW }, NOW),
    ).rejects.toThrow("outside a Better Auth transaction");
    await expect(
      db.transaction(() =>
        joinGroupInSignup(userId, { groupId, lastUsedAt: NOW }, NOW),
      ),
    ).rejects.toThrow("outside a Better Auth transaction");
    expect(await members()).toEqual([]);
  });

  it("la base suivie répond comme l’originale hors transaction", async () => {
    await aGroup(db, "LA COLOC", []);

    expect(await tracked.select().from(group)).toEqual(
      await db.select().from(group),
    );
  });
});
