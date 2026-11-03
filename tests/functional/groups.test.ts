import { cookies } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/create-database";
import { GROUP_COOKIE } from "@/domain/group";
import {
  chooseGroup,
  createGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  renameGroup,
} from "@/features/groups/actions";
import { decideSwipe } from "@/features/swipe/actions";
import { getGroups } from "@/server/container";
import { getActiveGroup, rememberGroup } from "@/server/groups";
import { assertSignedIn } from "@/server/session";
import { startServerStack } from "../helpers/functional";
import { aGroup, aUser } from "../helpers/groups";

vi.mock("@/server/session");
vi.mock("next/cache");
vi.mock("next/headers");

const LEA_ID = "user-1";

let db: Database;
let reset: () => Promise<void>;
beforeAll(async () => ({ db, reset } = await startServerStack()));
beforeEach(async () => {
  await reset();
  (await cookies()).delete(GROUP_COOKIE);
});

const displayed = async () => (await cookies()).get(GROUP_COOKIE);

async function created(name: string): Promise<string> {
  const formData = new FormData();
  formData.set("name", name);
  const result = await createGroup(formData);
  if (!result.ok) throw new Error(result.error);
  return result.groupId;
}

describe("groupes (fonctionnel)", () => {
  it("createGroup crée le groupe, m’en rend membre et l’affiche", async () => {
    const groupId = await created("La coloc");

    expect(await getGroups().isMember(groupId, LEA_ID)).toBe(true);
    expect(await getGroups().groupsOf(LEA_ID)).toEqual([
      { id: groupId, name: "La coloc", memberCount: 1 },
    ]);
    expect(await displayed()).toMatchObject({
      value: groupId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    await expect(getActiveGroup()).resolves.toMatchObject({
      group: { id: groupId },
    });
  });

  it("chooseGroup affiche un de mes groupes et le fait passer en tête", async () => {
    const older = await created("La coloc");
    await created("Le club");

    await chooseGroup(older);

    expect((await displayed())?.value).toBe(older);
    const [first] = await getGroups().groupsOf(LEA_ID);
    expect(first?.id).toBe(older);
  });

  it("chooseGroup d’un groupe étranger lève une exception sans poser de cookie", async () => {
    const hugo = await aUser(db, "Hugo");
    const foreign = await aGroup(db, "Chez Hugo", [hugo]);

    await expect(chooseGroup(foreign)).rejects.toThrow(
      "Server Action refused: not a member",
    );
    expect(await displayed()).toBeUndefined();
    expect(await getGroups().isMember(foreign, LEA_ID)).toBe(false);
  });

  it("un cookie forgé vers un groupe étranger retombe sur un groupe à moi", async () => {
    const mine = await created("La coloc");
    const hugo = await aUser(db, "Hugo");
    const foreign = await aGroup(db, "Chez Hugo", [hugo]);
    (await cookies()).set(GROUP_COOKIE, foreign);

    await expect(getActiveGroup()).resolves.toMatchObject({
      group: { id: mine },
    });
  });

  it("renommer : groupsOf donne le nouveau nom", async () => {
    const groupId = await created("La coloc");
    const formData = new FormData();
    formData.set("name", "Le club");

    await expect(renameGroup(groupId, formData)).resolves.toEqual({ ok: true });

    expect(await getGroups().groupsOf(LEA_ID)).toMatchObject([
      { id: groupId, name: "Le club" },
    ]);
  });

  it("Hugo retire Léa : elle n’est plus membre et ses swipes sont refusés", async () => {
    const hugo = await aUser(db, "Hugo");
    const groupId = await aGroup(db, "NOUS DEUX", [LEA_ID, hugo]);

    await rememberGroup(groupId);
    // Hugo is the signed-in user for this one call (the mock is Léa by default).
    vi.mocked(assertSignedIn).mockResolvedValueOnce({
      userId: hugo,
      name: "Hugo",
      sessionId: "session-hugo",
    });

    await removeMember(groupId, LEA_ID);

    expect(await getGroups().isMember(groupId, LEA_ID)).toBe(false);
    expect(await getGroups().isMember(groupId, hugo)).toBe(true);
    // Not self-removal: the cookie is left alone.
    expect((await displayed())?.value).toBe(groupId);
    await expect(decideSwipe(groupId, 496243, "keep")).rejects.toThrow(
      "Server Action refused: not a member",
    );
  });

  it("retirer un non-membre est sans effet", async () => {
    const hugo = await aUser(db, "Hugo");
    const groupId = await aGroup(db, "NOUS DEUX", [LEA_ID]);

    await removeMember(groupId, hugo);

    expect(await getGroups().membersOf(groupId)).toHaveLength(1);
  });

  it("le dernier qui quitte supprime le groupe : plus de groupe affiché", async () => {
    const groupId = await created("La coloc");

    await leaveGroup(groupId);

    expect(await displayed()).toMatchObject({ value: "", maxAge: 0 });
    expect(await getGroups().groupsOf(LEA_ID)).toEqual([]);
    await expect(getActiveGroup()).resolves.toMatchObject({ group: null });
  });

  it("quitter un autre groupe que celui du cookie laisse ce cookie", async () => {
    const hugo = await aUser(db, "Hugo");
    const left = await aGroup(db, "CHEZ HUGO", [LEA_ID, hugo]);
    const kept = await created("La coloc");

    await leaveGroup(left);

    expect((await displayed())?.value).toBe(kept);
    expect(await getGroups().isMember(left, LEA_ID)).toBe(false);
  });

  it("joinGroup avec un lien valide : membre, groupe affiché", async () => {
    const hugo = await aUser(db, "Hugo");
    const groupId = await aGroup(db, "CHEZ HUGO", [hugo]);
    const token = await getGroups().ensureInvite(groupId);

    await expect(joinGroup(token)).resolves.toEqual({ ok: true, groupId });

    expect(await getGroups().isMember(groupId, LEA_ID)).toBe(true);
    expect((await displayed())?.value).toBe(groupId);
  });

  it("joinGroup avec un lien d’un groupe où je suis déjà : bascule sur lui", async () => {
    const hugo = await aUser(db, "Hugo");
    const groupId = await aGroup(db, "CHEZ HUGO", [hugo, LEA_ID]);
    const token = await getGroups().ensureInvite(groupId);
    await created("La coloc");

    await joinGroup(token);

    expect((await displayed())?.value).toBe(groupId);
    const [first] = await getGroups().groupsOf(LEA_ID);
    expect(first?.id).toBe(groupId);
    expect(await getGroups().membersOf(groupId)).toHaveLength(2);
  });

  it("joinGroup avec un lien régénéré : refusé, sans écriture", async () => {
    const hugo = await aUser(db, "Hugo");
    const groupId = await aGroup(db, "CHEZ HUGO", [hugo]);
    const old = await getGroups().ensureInvite(groupId);
    await getGroups().regenerateInvite(groupId);

    await expect(joinGroup(old)).resolves.toEqual({
      ok: false,
      error: "CE LIEN N’EST PLUS VALABLE",
    });

    expect(await getGroups().isMember(groupId, LEA_ID)).toBe(false);
    expect(await displayed()).toBeUndefined();
  });
});
