import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot, NETFLIX } from "@tests/helpers/movies";
import type { Database } from "./create-database";
import { createDecisions } from "./decisions";
import { createGroupList } from "./group-list";
import { movieSnapshot } from "./group-schema";
import { createSnapshots, type Snapshots } from "./snapshots";

let db: Database;
let snapshots: Snapshots;

beforeEach(async () => {
  db = await aDatabase();
  snapshots = createSnapshots(db);
});

describe("instantanés", () => {
  it("upsert enregistre un film puis le met à jour", async () => {
    await snapshots.upsert(aSnapshot(1, { title: "Avant" }));
    await snapshots.upsert(
      aSnapshot(1, { title: "Après", providers: [NETFLIX], genreIds: [18] }),
    );

    expect(await db.select().from(movieSnapshot)).toEqual([
      aSnapshot(1, { title: "Après", providers: [NETFLIX], genreIds: [18] }),
    ]);
  });

  it("get relit la fiche d'un film connu, null sinon", async () => {
    await snapshots.upsert(aSnapshot(1, { providers: [NETFLIX] }));

    expect(await snapshots.get(1)).toEqual(
      aSnapshot(1, { providers: [NETFLIX] }),
    );
    expect(await snapshots.get(2)).toBeNull();
  });

  it("refresh met à jour un film connu, sans jamais en créer", async () => {
    await snapshots.upsert(aSnapshot(1));

    expect(await snapshots.refresh(aSnapshot(1, { trailerKey: "abc" }))).toBe(
      "applied",
    );
    expect(await snapshots.refresh(aSnapshot(2))).toBe("noop");
    expect(await db.select().from(movieSnapshot)).toEqual([
      aSnapshot(1, { trailerKey: "abc" }),
    ]);
  });

  it("listedIds dédoublonne entre groupes et ignore les films écartés", async () => {
    const lea = await aUser(db, "Léa");
    const a = await aGroup(db, "A", [lea]);
    const b = await aGroup(db, "B", [lea]);
    const decisions = createDecisions(db);
    const list = createGroupList(db);
    const keep = (groupId: string, tmdbId: number) =>
      decisions.swipe({
        groupId,
        userId: lea,
        tmdbId,
        decision: "keep",
        snapshot: aSnapshot(tmdbId),
      });
    await keep(a, 1);
    await keep(b, 1);
    await keep(a, 2);
    await list.apply({
      groupId: a,
      userId: lea,
      action: "mark_watched",
      tmdbId: 2,
    });
    await keep(a, 3);
    await list.apply({ groupId: a, userId: lea, action: "remove", tmdbId: 3 });
    await snapshots.upsert(aSnapshot(4));
    await decisions.swipe({
      groupId: a,
      userId: lea,
      tmdbId: 5,
      decision: "reject",
    });

    expect((await snapshots.listedIds()).toSorted()).toEqual([1, 2]);
  });
});
