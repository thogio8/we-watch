import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import type { SwipeDecision } from "@/domain/transitions";
import type { Database } from "./create-database";
import { createDecisions, type Decisions } from "./decisions";
import { createFavorites } from "./favorites";
import { createGroupList, type GroupList } from "./group-list";
import { movieSnapshot } from "./group-schema";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);
const NOTHING_MATCHED = { result: "applied", matched: false };

let db: Database;
let decisions: Decisions;
let list: GroupList;
let lea: string;
let hugo: string;
let groupe: string;
let autre: string;

beforeEach(async () => {
  db = await aDatabase();
  decisions = createDecisions(db);
  list = createGroupList(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
  groupe = await aGroup(db, "NOUS DEUX", [lea, hugo]);
  autre = await aGroup(db, "CINÉ-CLUB", [hugo]);
});

interface Swipe {
  userId: string;
  decision?: SwipeDecision;
  tmdbId?: number;
  groupId?: string;
  title?: string;
  now?: Date;
}

const swipe = ({ userId, decision = "keep", tmdbId = 1, ...rest }: Swipe) => {
  const who = {
    groupId: rest.groupId ?? groupe,
    userId,
    tmdbId,
    now: rest.now ?? T0,
  };
  const title = rest.title ?? `Film ${tmdbId}`;
  return decisions.swipe(
    decision === "keep"
      ? { ...who, decision, snapshot: aSnapshot(tmdbId, { title }) }
      : { ...who, decision },
  );
};

const undo = (userId: string, decision: SwipeDecision = "keep", tmdbId = 1) =>
  decisions.undoSwipe({ groupId: groupe, userId, tmdbId, decision });

const wantedBy = async (tmdbId = 1) =>
  (await list.findInList(groupe, tmdbId))?.wantedBy;

describe("décisions de swipe", () => {
  it("« ON LE VEUT » ajoute le film à la liste et le « voulu », une seule fois", async () => {
    expect(await swipe({ userId: lea, title: "Whiplash" })).toEqual(
      NOTHING_MATCHED,
    );

    expect(await list.findInList(groupe, 1)).toMatchObject({
      title: "Whiplash",
      status: "to_watch",
      decidedAt: T0,
      addedBy: "Léa",
      wantedBy: ["Léa"],
    });
    expect(await swipe({ userId: lea })).toEqual({
      result: "noop",
      matched: false,
    });
  });

  it("deux « ON LE VEUT » de Léa puis Hugo : une ligne, voulue par les deux", async () => {
    await swipe({ userId: lea, now: T0 });
    expect(await swipe({ userId: hugo, title: "Nouveau", now: T1 })).toEqual({
      result: "applied",
      matched: true,
    });

    const listed = await list.listByStatus(groupe, "to_watch");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      title: "Nouveau",
      addedBy: "Léa",
      decidedAt: T0,
    });
    expect(await wantedBy()).toEqual(["Léa", "Hugo"]);
  });

  it("range les souhaits par date", async () => {
    await swipe({ userId: lea, now: T1 });
    await swipe({ userId: hugo, now: T0 });

    expect(await wantedBy()).toEqual(["Hugo", "Léa"]);
  });

  it("garde l’ordre des souhaits à la même milliseconde", async () => {
    await swipe({ userId: lea });
    await swipe({ userId: hugo });

    expect(await wantedBy()).toEqual(["Léa", "Hugo"]);
  });

  it("« ON LE VEUT » sur un film déjà vu enregistre le souhait sans toucher la liste", async () => {
    await swipe({ userId: lea });
    await list.apply({
      groupId: groupe,
      userId: lea,
      action: "mark_watched",
      tmdbId: 1,
    });

    expect(await swipe({ userId: hugo })).toEqual(NOTHING_MATCHED);
    expect(await list.findInList(groupe, 1)).toMatchObject({
      status: "watched",
      wantedBy: ["Léa", "Hugo"],
    });
  });

  it("« ON LE VEUT » de Léa puis « BOF » de Hugo : le BOF ne cache le film qu’à Hugo", async () => {
    await swipe({ userId: lea });
    expect(await swipe({ userId: hugo, decision: "reject" })).toEqual(
      NOTHING_MATCHED,
    );
    expect(await swipe({ userId: hugo, decision: "reject" })).toEqual({
      result: "noop",
      matched: false,
    });

    expect(await list.findInList(groupe, 1)).toMatchObject({
      wantedBy: ["Léa"],
    });
    expect(await decisions.deckExclusions(groupe, hugo)).toEqual(new Set([1]));
    expect(await decisions.deckExclusions(groupe, lea)).toEqual(new Set([1]));
    expect(await decisions.deckExclusions(autre, hugo)).toEqual(new Set([1]));
    expect(await list.findInList(autre, 1)).toBeNull();
  });

  it("la pile exclut toute la liste du groupe, écartés compris, et mes BOF seulement", async () => {
    await swipe({ userId: lea, tmdbId: 1 });
    await swipe({ userId: lea, tmdbId: 2 });
    await list.apply({
      groupId: groupe,
      userId: lea,
      action: "remove",
      tmdbId: 2,
    });
    await swipe({ userId: hugo, tmdbId: 3, decision: "reject" });
    await swipe({ userId: lea, tmdbId: 4, groupId: autre });

    expect(await decisions.deckExclusions(groupe, lea)).toEqual(
      new Set([1, 2]),
    );
    expect(await decisions.deckExclusions(groupe, hugo)).toEqual(
      new Set([1, 2, 3]),
    );
  });

  it("« ON LE VEUT » n’écrit rien si une écriture échoue", async () => {
    await expect(swipe({ userId: "inconnu" })).rejects.toThrow();

    expect(await db.$count(movieSnapshot)).toBe(0);
  });
});

describe("annuler un swipe", () => {
  it("annulation par Léa après qu’Hugo a aussi voulu le film : la ligne reste", async () => {
    await swipe({ userId: lea });
    await swipe({ userId: hugo });

    expect(await undo(lea)).toBe("applied");
    expect(await wantedBy()).toEqual(["Hugo"]);
  });

  it("annulation par Léa d’un film qu’elle seule a voulu : la ligne disparaît", async () => {
    await swipe({ userId: lea });

    expect(await undo(lea)).toBe("applied");
    expect(await list.findInList(groupe, 1)).toBeNull();
    expect(await decisions.deckExclusions(groupe, lea)).toEqual(new Set());
    expect(await undo(lea)).toBe("noop");
  });

  it("annulation par Léa d’un film qu’elle seule a voulu, mais qu’Hugo vient de mettre en coup de cœur : la ligne reste, coup de cœur compris", async () => {
    await swipe({ userId: lea });
    await createFavorites(db).set({
      groupId: groupe,
      userId: hugo,
      tmdbId: 1,
      on: true,
      now: T1,
    });

    expect(await undo(lea)).toBe("applied");
    expect(await list.findInList(groupe, 1)).toMatchObject({
      status: "to_watch",
      wantedBy: [],
      favoriteAt: T1,
      favoriteBy: "Hugo",
    });
  });

  it("annulation après que le film a été marqué vu : la ligne reste", async () => {
    await swipe({ userId: lea });
    await list.apply({
      groupId: groupe,
      userId: lea,
      action: "mark_watched",
      tmdbId: 1,
    });

    expect(await undo(lea)).toBe("applied");
    expect(await list.findInList(groupe, 1)).toMatchObject({
      status: "watched",
      wantedBy: [],
    });
  });

  it("annulation par Hugo d’un film ajouté par Léa : seul son souhait part", async () => {
    await swipe({ userId: lea });
    await swipe({ userId: hugo });
    await undo(lea);

    expect(await undo(hugo)).toBe("applied");
    expect(await list.findInList(groupe, 1)).toMatchObject({
      addedBy: "Léa",
      wantedBy: [],
    });
  });

  it("annulation d’un souhait sur un film ajouté par la recherche : la ligne reste", async () => {
    await list.apply({
      groupId: groupe,
      userId: lea,
      action: "search_add",
      tmdbId: 1,
      snapshot: aSnapshot(1),
    });
    await swipe({ userId: lea });

    expect(await undo(lea)).toBe("applied");
    expect(await list.findInList(groupe, 1)).toMatchObject({ wantedBy: [] });
  });

  it("annuler un BOF le retire, sans toucher la liste", async () => {
    await swipe({ userId: lea });
    await swipe({ userId: hugo, tmdbId: 2, decision: "reject" });

    expect(await undo(hugo, "reject", 2)).toBe("applied");
    expect(await undo(hugo, "reject", 2)).toBe("noop");
    expect(await undo(hugo, "reject", 1)).toBe("noop");
    expect(await decisions.deckExclusions(autre, hugo)).toEqual(new Set());
    expect(await wantedBy()).toEqual(["Léa"]);
  });
});
