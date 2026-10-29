import { cookies } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/create-database";
import { GROUP_COOKIE } from "@/domain/group";
import { chooseGroup, createGroup } from "@/features/groups/actions";
import { getGroups } from "@/server/container";
import { getActiveGroup } from "@/server/groups";
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
});
