import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createFavorites } from "./favorites";
import { createGroupList, type GroupList } from "./group-list";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "./group-schema";
import { createGroups, type Groups } from "./groups";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);

let db: Database;
let groups: Groups;
let list: GroupList;
let decisions: Decisions;
let lea: string;
let hugo: string;
let groupA: string;

beforeEach(async () => {
  db = await aDatabase();
  groups = createGroups(db);
  list = createGroupList(db);
  decisions = createDecisions(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  groupA = await aGroup(db, "A", [lea, hugo]);
});

const keep = (tmdbId: number, userId: string, groupId = groupA) =>
  decisions.swipe({
    groupId,
    userId,
    tmdbId,
    decision: "keep",
    snapshot: aSnapshot(tmdbId),
    now: T0,
  });

const bof = (tmdbId: number, userId: string) =>
  decisions.swipe({ groupId: groupA, userId, tmdbId, decision: "reject" });

const count = (table: Parameters<Database["$count"]>[0]) => db.$count(table);

describe("rejoindre et renommer", () => {
  it("join ajoute un membre, qui vient d’utiliser le groupe", async () => {
    const solo = await aGroup(db, "SOLO", [lea]);

    expect(await groups.join(solo, hugo, T1)).toBe("joined");

    expect(await groups.isMember(solo, hugo)).toBe(true);
    expect((await groups.groupsOf(hugo))[0]).toMatchObject({
      id: solo,
      memberCount: 2,
    });
    expect(await groups.membersOf(solo)).toContainEqual({
      userId: hugo,
      name: "Hugo",
      joinedAt: T1,
    });
  });

  it("join d’un membre déjà là : « already », une seule ligne", async () => {
    expect(await groups.join(groupA, hugo)).toBe("already");
    expect(await db.$count(membership, eq(membership.userId, hugo))).toBe(1);
  });

  it("join d’un groupe disparu : « gone », sans ligne orpheline", async () => {
    expect(await groups.join("disparu", hugo)).toBe("gone");
    expect(await db.$count(membership, eq(membership.userId, hugo))).toBe(1);
  });

  it("rename change le nom du groupe pour tous ses membres", async () => {
    await groups.rename(groupA, "CINÉ-CLUB");

    expect((await groups.groupsOf(hugo))[0]?.name).toBe("CINÉ-CLUB");
  });

  it("membersOf liste les membres du plus ancien au plus récent", async () => {
    await db
      .update(membership)
      .set({ joinedAt: T1 })
      .where(eq(membership.userId, lea));
    await db
      .update(membership)
      .set({ joinedAt: T0 })
      .where(eq(membership.userId, hugo));

    expect(await groups.membersOf(groupA)).toEqual([
      { userId: hugo, name: "Hugo", joinedAt: T0 },
      { userId: lea, name: "Léa", joinedAt: T1 },
    ]);
    expect(await groups.membersOf("forgé")).toEqual([]);
  });
});

describe("partir", () => {
  it("le partant perd ses « voulu » du groupe ; ses ajouts restent, avec son prénom", async () => {
    await keep(1, hugo);
    await keep(1, lea);
    await keep(2, hugo);
    const other = await aGroup(db, "B", [hugo]);
    await keep(1, hugo, other);

    expect(await groups.leave(groupA, hugo)).toBe("left");

    expect(await groups.isMember(groupA, hugo)).toBe(false);
    expect(await list.findInList(groupA, 1)).toMatchObject({
      addedBy: "Hugo",
      wantedBy: ["Léa"],
    });
    expect(await list.findInList(groupA, 2)).toMatchObject({
      addedBy: "Hugo",
      wantedBy: [],
    });
    expect(await list.findInList(other, 1)).toMatchObject({
      wantedBy: ["Hugo"],
    });
  });

  it("le partant laisse ses coups de cœur au groupe, avec son prénom", async () => {
    await keep(1, lea);
    await createFavorites(db).set({
      groupId: groupA,
      userId: hugo,
      tmdbId: 1,
      on: true,
      now: T1,
    });

    expect(await groups.leave(groupA, hugo)).toBe("left");

    expect(await list.findInList(groupA, 1)).toMatchObject({
      favoriteAt: T1,
      favoriteBy: "Hugo",
    });
  });

  it("le dernier qui part supprime le groupe et sa liste, pas les instantanés, les BOF ni les autres groupes", async () => {
    const other = await aGroup(db, "B", [lea]);
    await keep(1, lea);
    await keep(1, lea, other);
    await bof(2, lea);

    expect(await groups.leave(groupA, hugo)).toBe("left");
    expect(await groups.leave(groupA, lea)).toBe("group_deleted");

    expect(await db.$count(group, eq(group.id, groupA))).toBe(0);
    expect(await db.$count(groupMovie, eq(groupMovie.groupId, groupA))).toBe(0);
    expect(await db.$count(movieWant, eq(movieWant.groupId, groupA))).toBe(0);
    expect(await db.$count(membership, eq(membership.groupId, groupA))).toBe(0);
    expect(await count(movieSnapshot)).toBe(1);
    expect(await count(movieRejection)).toBe(1);
    expect(await list.findInList(other, 1)).toMatchObject({
      wantedBy: ["Léa"],
    });
  });

  it("supprime le groupe sans compter sur les clés étrangères", async () => {
    await keep(1, lea);
    await db.run(sql`PRAGMA foreign_keys = OFF`);

    await groups.leave(groupA, hugo);
    expect(await groups.leave(groupA, lea)).toBe("group_deleted");

    expect(await count(groupMovie)).toBe(0);
    expect(await count(movieWant)).toBe(0);
    expect(await count(membership)).toBe(0);
  });

  it("un non-membre qui part : « not_member », rien n’est écrit", async () => {
    const solo = await aGroup(db, "SOLO", [lea]);
    await keep(1, lea, solo);

    expect(await groups.leave(solo, hugo)).toBe("not_member");
    expect(await groups.leave("forgé", hugo)).toBe("not_member");

    expect(await groups.membersOf(solo)).toHaveLength(1);
    expect(await count(movieWant)).toBe(1);
  });

  // The in-memory client has one connection: a concurrent member is staged
  // with a TEMP trigger, fired by one of the departure's own statements.
  const stage = (trigger: string) => db.run(sql.raw(trigger));

  it("deux départs concurrents d’un groupe à deux le suppriment une seule fois", async () => {
    await keep(1, lea);
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    // Hugo's whole departure lands between Léa leaving and her emptiness
    // check: it already took the group and its list along.
    await stage(`
      CREATE TEMP TRIGGER hugo_leaves AFTER DELETE ON membership
      WHEN OLD.user_id = '${lea}'
      BEGIN
        DELETE FROM membership WHERE user_id = '${hugo}';
        DELETE FROM movie_want WHERE group_id = OLD.group_id;
        DELETE FROM group_movie WHERE group_id = OLD.group_id;
        DELETE FROM app_group WHERE id = OLD.group_id;
      END`);

    expect(await groups.leave(groupA, lea)).toBe("left");

    expect(await count(group)).toBe(0);
    expect(await count(groupMovie)).toBe(0);
    expect(await count(membership)).toBe(0);
  });

  it("quelqu’un qui rejoint entre le constat « plus personne » et la suppression garde le groupe, sans appartenance orpheline", async () => {
    const solo = await aGroup(db, "SOLO", [lea]);
    await keep(1, lea, solo);
    await keep(2, hugo);
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    // Hugo joins once the departure has found the group empty, as it starts
    // deleting the group's rows.
    await stage(`
      CREATE TEMP TRIGGER hugo_joins BEFORE DELETE ON group_movie
      WHEN OLD.group_id = '${solo}'
      BEGIN
        INSERT OR IGNORE INTO membership (group_id, user_id, joined_at)
        VALUES (OLD.group_id, '${hugo}', 0);
      END`);

    expect(await groups.leave(solo, lea)).toBe("left");

    expect(await db.$count(group, eq(group.id, solo))).toBe(1);
    expect(await groups.membersOf(solo)).toMatchObject([{ userId: hugo }]);
    const orphans = await db.all(
      sql`select 1 from membership where group_id not in (select id from app_group)`,
    );
    expect(orphans).toEqual([]);
    // The other group is untouched.
    expect(await list.findInList(groupA, 2)).toMatchObject({
      wantedBy: ["Hugo"],
    });
  });
});
