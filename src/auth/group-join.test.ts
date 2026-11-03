import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";
import { aDatabase, aGroup, aUser } from "../../tests/helpers/groups";
import { joinInvitedGroup } from "./group-join";
import { trackTransactions } from "./signup-transaction";

const NOW = new Date("2026-10-30T20:00:00.000Z");

describe("joinInvitedGroup", () => {
  let db: Database;
  let tracked: Database;
  let userId: string;
  beforeEach(async () => {
    db = await aDatabase();
    tracked = trackTransactions(db);
    userId = await aUser(db, "Léa");
  });

  const members = () => db.select().from(membership);
  const inSignup = (groupId: string) =>
    tracked.transaction(() => joinInvitedGroup(userId, groupId, NOW));

  it("rejoint le groupe de l’invitation, affiché, dans la transaction de l’inscription", async () => {
    const groupId = await aGroup(db, "LA COLOC", []);

    await inSignup(groupId);

    expect(await members()).toEqual([
      { groupId, userId, joinedAt: NOW, lastUsedAt: NOW },
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
        await joinInvitedGroup(userId, groupId, NOW);
        throw new Error("passkey already registered");
      }),
    ).rejects.toThrow("passkey already registered");

    expect(await members()).toEqual([]);
  });

  it("hors d’une transaction de Better Auth : refuse d’écrire", async () => {
    const groupId = await aGroup(db, "LA COLOC", []);

    await expect(joinInvitedGroup(userId, groupId, NOW)).rejects.toThrow(
      "outside a Better Auth transaction",
    );
    await expect(
      db.transaction(() => joinInvitedGroup(userId, groupId, NOW)),
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
