import { cookies } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/create-database";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "@/db/group-schema";
import { GROUP_COOKIE } from "@/domain/group";
import { markWatched } from "@/features/draw/actions";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  setFavorite,
  unwatch,
} from "@/features/list/actions";
import {
  inviteLink,
  leaveGroup,
  regenerateInviteLink,
  removeMember,
  renameGroup,
} from "@/features/groups/actions";
import { loadMoviePage } from "@/features/movie/load";
import {
  decideSwipe,
  loadMoreCards,
  undoSwipe,
} from "@/features/swipe/actions";
import { getDecisions, getGroupList } from "@/server/container";
import { rememberGroup } from "@/server/groups";
import { startServerStack } from "../helpers/functional";
import { aGroup, aUser } from "../helpers/groups";
import { aSnapshot } from "../helpers/movies";
import { REFUSED } from "../helpers/refused";

// Real assertMember and database; only the session is mocked (Léa).
vi.mock("@/server/session");
vi.mock("next/cache");
vi.mock("next/headers");

const LEA = "user-1";
const PARASITE = 496243;
const WHIPLASH = 244786;
const CHIHIRO = 129;
const AMELIE = 194;

let db: Database;
let reset: () => Promise<void>;
let mine: string;
let theirs: string;
let hugo: string;
beforeAll(async () => ({ db, reset } = await startServerStack()));

/**
 * Hugo's group B: Parasite to watch (he wants it), Whiplash watched, Chihiro
 * set aside, his BOF on Amélie. Plus what an unguarded undo by Léa would
 * delete: her own wish on Parasite in B (written directly, she is not a
 * member) and her BOF on Amélie.
 */
async function hugosGroup(hugo: string): Promise<string> {
  const groupId = await aGroup(db, "CHEZ HUGO", [hugo]);
  const list = getGroupList();
  await getDecisions().swipe({
    groupId,
    userId: hugo,
    tmdbId: PARASITE,
    decision: "keep",
    snapshot: aSnapshot(PARASITE),
  });
  for (const tmdbId of [WHIPLASH, CHIHIRO]) {
    const snapshot = aSnapshot(tmdbId);
    await list.apply({
      groupId,
      userId: hugo,
      action: "search_add",
      tmdbId,
      snapshot,
    });
  }
  await list.apply({
    groupId,
    userId: hugo,
    action: "mark_watched",
    tmdbId: WHIPLASH,
  });
  await list.apply({
    groupId,
    userId: hugo,
    action: "remove",
    tmdbId: CHIHIRO,
  });
  await getDecisions().swipe({
    groupId,
    userId: hugo,
    tmdbId: AMELIE,
    decision: "reject",
  });
  const now = new Date();
  await db
    .insert(movieWant)
    .values({ groupId, tmdbId: PARASITE, userId: LEA, wantedAt: now });
  await db
    .insert(movieRejection)
    .values({ userId: LEA, tmdbId: AMELIE, rejectedAt: now });
  return groupId;
}

beforeEach(async () => {
  await reset();
  (await cookies()).delete(GROUP_COOKIE);
  hugo = await aUser(db, "Hugo");
  mine = await aGroup(db, "NOUS DEUX", [LEA]);
  theirs = await hugosGroup(hugo);
});

/** Every row a group action could touch, in a stable order. */
const everything = async () => ({
  list: await db.select().from(groupMovie).orderBy(groupMovie.tmdbId),
  wants: await db.select().from(movieWant).orderBy(movieWant.tmdbId),
  rejections: await db.select().from(movieRejection),
  members: await db.select().from(membership).orderBy(membership.groupId),
  groups: await db.select().from(group).orderBy(group.id),
  snapshots: await db
    .select()
    .from(movieSnapshot)
    .orderBy(movieSnapshot.tmdbId),
});

const renamed = (name: string) => {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
};

/** Every action on a group, called on `groupId`, each on the movie it would change in B. */
const ACTIONS = [
  ["markWatched", (g: string) => markWatched(g, PARASITE)],
  ["removeFromList", (g: string) => removeFromList(g, PARASITE)],
  ["unwatch", (g: string) => unwatch(g, WHIPLASH)],
  ["setFavorite", (g: string) => setFavorite(g, PARASITE, true)],
  ["searchCatalog", (g: string) => searchCatalog(g, "parasite")],
  ["addFromSearch (nouveau film)", (g: string) => addFromSearch(g, AMELIE)],
  ["addFromSearch (film écarté)", (g: string) => addFromSearch(g, CHIHIRO)],
  ["decideSwipe ♥", (g: string) => decideSwipe(g, AMELIE, "keep")],
  ["decideSwipe ✕", (g: string) => decideSwipe(g, PARASITE, "reject")],
  ["undoSwipe ♥", (g: string) => undoSwipe(g, PARASITE, "keep")],
  ["undoSwipe ✕", (g: string) => undoSwipe(g, AMELIE, "reject")],
  ["loadMoreCards", (g: string) => loadMoreCards(g, "top", 1)],
  ["renameGroup", (g: string) => renameGroup(g, renamed("PIRATÉ"))],
  ["inviteLink", (g: string) => inviteLink(g)],
  ["regenerateInviteLink", (g: string) => regenerateInviteLink(g)],
  // Hugo, a member of B: someone I could really remove, were I a member.
  ["removeMember", (g: string) => removeMember(g, hugo)],
  ["leaveGroup", (g: string) => leaveGroup(g)],
] as const;

async function refusedWithoutWriting(call: () => Promise<unknown>) {
  const before = await everything();

  await expect(call()).rejects.toThrow(REFUSED);

  expect(await everything()).toEqual(before);
}

describe("isolation des groupes (fonctionnel, sécurité)", () => {
  it.each(ACTIONS)(
    "%s sur le groupe d’un autre : refusé, rien n’est écrit",
    (_name, action) => refusedWithoutWriting(() => action(theirs)),
  );

  describe.each([
    ["un identifiant forgé", "groupe-inexistant"],
    ["un identifiant vide", ""],
    ["autre chose qu’une chaîne", { id: "x" }],
  ])("%s", (_label, forged) => {
    it.each(ACTIONS)("%s : refusé, rien n’est écrit", (_name, action) =>
      refusedWithoutWriting(() => action(forged as string)),
    );
  });

  it("la fiche d’un film du groupe d’un autre est introuvable", async () => {
    await expect(loadMoviePage(theirs, String(PARASITE))).resolves.toBeNull();
    // Through my own group's URL, a movie only they have is not found either.
    await expect(loadMoviePage(mine, String(PARASITE))).resolves.toBeNull();
  });

  it("l’action porte sur le groupe affiché, même si un autre onglet en a choisi un autre", async () => {
    const other = await aGroup(db, "LA COLOC", [LEA]);
    await addFromSearch(mine, AMELIE);
    // Another tab switched the displayed group in the meantime.
    await rememberGroup(other);

    await markWatched(mine, AMELIE);

    const [watched] = await getGroupList().listByStatus(mine, "watched");
    expect(watched).toMatchObject({ tmdbId: AMELIE, watchedBy: "Léa" });
    expect(await getGroupList().counts(other)).toEqual({
      toWatch: 0,
      watched: 0,
      favorites: 0,
      matches: 0,
    });
  });
});
