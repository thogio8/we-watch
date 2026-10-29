import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember, rememberGroup } from "@/server/groups";
import { revalidateGroupPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { chooseGroup, createGroup } from "./actions";

const create = vi.fn();
const touch = vi.fn();

vi.mock("@/server/session");
vi.mock("@/server/groups");
vi.mock("@/server/revalidate");
vi.mock("@/server/container", () => ({
  getGroups: () => ({ create, touch }),
}));

const LEA = { userId: "user-1", name: "Léa" };
const REFUSED = "Server Action refused: not a member";

const named = (name?: unknown) => {
  const formData = new FormData();
  if (typeof name === "string") formData.set("name", name);
  return formData;
};

beforeEach(() => {
  vi.mocked(assertSignedIn).mockReset().mockResolvedValue(LEA);
  vi.mocked(assertMember)
    .mockReset()
    .mockImplementation(async (groupId) => ({
      user: LEA,
      groupId: groupId as string,
    }));
  vi.mocked(rememberGroup).mockReset();
  vi.mocked(revalidateGroupPages).mockReset();
  create.mockReset().mockImplementation(async ({ name }) => ({
    id: "g-9",
    name,
    memberCount: 1,
  }));
  touch.mockReset();
});

describe("createGroup", () => {
  it("crée le groupe au nom normalisé, l’affiche et rafraîchit les pages", async () => {
    await expect(createGroup(named("  La   coloc "))).resolves.toEqual({
      ok: true,
      groupId: "g-9",
    });

    expect(create).toHaveBeenCalledWith({ name: "La coloc", userId: "user-1" });
    expect(rememberGroup).toHaveBeenCalledWith("g-9");
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
  });

  it.each([
    ["un nom vide", ""],
    ["31 caractères", "x".repeat(31)],
    ["aucun nom", undefined],
  ])("refuse %s sans rien créer", async (_, name) => {
    await expect(createGroup(named(name))).resolves.toEqual({
      ok: false,
      error: "UN NOM DE 1 À 30 CARACTÈRES",
    });
    expect(create).not.toHaveBeenCalled();
    expect(rememberGroup).not.toHaveBeenCalled();
    expect(revalidateGroupPages).not.toHaveBeenCalled();
  });

  it("sans session : refuse sans rien créer", async () => {
    vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

    await expect(createGroup(named("La coloc"))).rejects.toThrow(
      "not signed in",
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe("chooseGroup", () => {
  it("vérifie l’appartenance, affiche le groupe et le marque utilisé", async () => {
    await chooseGroup("g-2");

    expect(assertMember).toHaveBeenCalledWith("g-2");
    expect(rememberGroup).toHaveBeenCalledWith("g-2");
    expect(touch).toHaveBeenCalledWith("g-2", "user-1");
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
  });

  it("un groupe dont je ne suis pas membre : refusé, rien n’est écrit", async () => {
    vi.mocked(assertMember).mockRejectedValue(new Error(REFUSED));

    await expect(chooseGroup("g-3")).rejects.toThrow(REFUSED);
    expect(rememberGroup).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
    expect(revalidateGroupPages).not.toHaveBeenCalled();
  });
});
