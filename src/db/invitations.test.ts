import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { isInviteToken } from "@/domain/group";
import type { Database } from "./create-database";
import { createGroups, type Groups } from "./groups";

let db: Database;
let groups: Groups;
let groupA: string;
let groupB: string;

beforeEach(async () => {
  db = await aDatabase();
  groups = createGroups(db);
  const lea = await aUser(db, "Léa");
  groupA = await aGroup(db, "A", [lea]);
  groupB = await aGroup(db, "B", [lea]);
});

describe("liens d’invitation", () => {
  it("ensureInvite crée un jeton bien formé, puis renvoie toujours le même", async () => {
    const token = await groups.ensureInvite(groupA);

    expect(isInviteToken(token)).toBe(true);
    expect(await groups.ensureInvite(groupA)).toBe(token);
  });

  it("deux groupes ont deux jetons différents", async () => {
    expect(await groups.ensureInvite(groupA)).not.toBe(
      await groups.ensureInvite(groupB),
    );
  });

  it("ensureInvite refuse un groupe inconnu", async () => {
    await expect(groups.ensureInvite("forgé")).rejects.toThrow(
      "unknown group forgé",
    );
  });

  it("findByInvite retrouve le groupe de son jeton", async () => {
    const token = await groups.ensureInvite(groupA);

    expect(await groups.findByInvite(token)).toEqual({ id: groupA, name: "A" });
    expect(await groups.findByInvite("x".repeat(43))).toBeNull();
  });

  it("regenerateInvite donne un nouveau jeton, et l’ancien ne mène plus nulle part", async () => {
    const old = await groups.ensureInvite(groupA);

    const fresh = await groups.regenerateInvite(groupA);

    expect(isInviteToken(fresh)).toBe(true);
    expect(fresh).not.toBe(old);
    expect(await groups.findByInvite(old)).toBeNull();
    expect(await groups.findByInvite(fresh)).toMatchObject({ id: groupA });
    expect(await groups.ensureInvite(groupA)).toBe(fresh);
  });

  it("regenerateInvite crée un jeton pour un groupe qui n’en avait pas", async () => {
    const token = await groups.regenerateInvite(groupB);

    expect(await groups.findByInvite(token)).toMatchObject({ id: groupB });
  });

  it("regenerateInvite refuse un groupe inconnu", async () => {
    await expect(groups.regenerateInvite("forgé")).rejects.toThrow(
      "unknown group forgé",
    );
  });
});
