import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import type { Database } from "./create-database";
import { membership } from "./group-schema";
import { createGroups, type Groups } from "./groups";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);
const T2 = new Date(2026, 9, 3);

let db: Database;
let groups: Groups;
let lea: string;
let hugo: string;

beforeEach(async () => {
  db = await aDatabase();
  groups = createGroups(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
});

const lastUsedAt = async (groupId: string, userId: string) => {
  const [row] = await db
    .select({ at: membership.lastUsedAt })
    .from(membership)
    .where(and(eq(membership.groupId, groupId), eq(membership.userId, userId)));
  return row?.at;
};

const names = async (userId: string) =>
  (await groups.groupsOf(userId)).map((g) => g.name);

describe("groupes", () => {
  it("create fait du créateur le seul membre, groupe tout juste utilisé", async () => {
    const created = await groups.create({
      name: "CINÉ-CLUB",
      userId: lea,
      now: T0,
    });

    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: "CINÉ-CLUB",
      memberCount: 1,
    });
    expect(await groups.isMember(created.id, lea)).toBe(true);
    expect(await groups.isMember(created.id, hugo)).toBe(false);
    expect(await lastUsedAt(created.id, lea)).toEqual(T0);
    expect(await groups.groupsOf(lea)).toEqual([created]);
  });

  it("isMember refuse un groupe inconnu", async () => {
    expect(await groups.isMember("forgé", lea)).toBe(false);
  });

  it("groupsOf trie par dernier usage, puis par ancienneté, et compte les membres", async () => {
    const ancien = await aGroup(db, "ANCIEN", [lea, hugo]);
    const recent = await aGroup(db, "RÉCENT", [lea]);
    await db
      .update(membership)
      .set({ joinedAt: T0 })
      .where(eq(membership.groupId, ancien));
    await db
      .update(membership)
      .set({ joinedAt: T1 })
      .where(eq(membership.groupId, recent));
    await groups.create({ name: "HIER", userId: lea, now: T1 });
    await groups.create({ name: "AUJOURD’HUI", userId: lea, now: T2 });
    await aGroup(db, "SANS LÉA", [hugo]);

    expect(await groups.groupsOf(lea)).toMatchObject([
      { name: "AUJOURD’HUI", memberCount: 1 },
      { name: "HIER", memberCount: 1 },
      { name: "ANCIEN", memberCount: 2 },
      { name: "RÉCENT", memberCount: 1 },
    ]);
    expect(await names(hugo)).toEqual(["ANCIEN", "SANS LÉA"]);
  });

  it("groupsOf est vide pour qui n’a aucun groupe", async () => {
    expect(await groups.groupsOf(hugo)).toEqual([]);
  });

  it("touch marque le groupe comme le dernier utilisé, pour ce membre seulement", async () => {
    const a = await groups.create({ name: "A", userId: lea, now: T1 });
    await groups.create({ name: "B", userId: lea, now: T2 });

    await groups.touch(a.id, lea, new Date(2026, 9, 4));
    await groups.touch(a.id, hugo);

    expect(await names(lea)).toEqual(["A", "B"]);
    expect(await groups.isMember(a.id, hugo)).toBe(false);
  });

  it("touch prend l’heure courante par défaut", async () => {
    const a = await groups.create({ name: "A", userId: lea });
    const before = Date.now();

    await groups.touch(a.id, lea);

    expect((await lastUsedAt(a.id, lea))?.getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });
});
