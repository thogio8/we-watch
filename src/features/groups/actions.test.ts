import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { assertMember, forgetGroup, rememberGroup } from "@/server/groups";
import { revalidateGroupPages, revalidateListPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { expectRefusedFirst } from "../../../tests/helpers/refused";
import {
  chooseGroup,
  createGroup,
  inviteLink,
  joinGroup,
  leaveGroup,
  regenerateInviteLink,
  removeMember,
  renameGroup,
} from "./actions";

const create = vi.fn();
const touch = vi.fn();
const rename = vi.fn();
const ensureInvite = vi.fn();
const regenerateInvite = vi.fn();
const findByInvite = vi.fn();
const join = vi.fn();
const leave = vi.fn();

const TOKEN = "A".repeat(43);

vi.mock("@/server/session");
vi.mock("@/server/groups");
vi.mock("@/server/revalidate");
vi.mock("next/cache");
vi.mock("@/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_URL: "https://we.watch.test" }),
}));
vi.mock("@/server/container", () => ({
  getGroups: () => ({
    create,
    touch,
    rename,
    ensureInvite,
    regenerateInvite,
    findByInvite,
    join,
    leave,
  }),
}));

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
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
  vi.mocked(revalidateListPages).mockReset();
  create.mockReset().mockImplementation(async ({ name }) => ({
    id: "g-9",
    name,
    memberCount: 1,
  }));
  touch.mockReset();
  rename.mockReset();
  ensureInvite.mockReset().mockResolvedValue(TOKEN);
  regenerateInvite.mockReset().mockResolvedValue("B".repeat(43));
  findByInvite.mockReset().mockResolvedValue({ id: "g-5", name: "LA COLOC" });
  join.mockReset().mockResolvedValue("joined");
  leave.mockReset().mockResolvedValue("left");
  vi.mocked(forgetGroup).mockReset();
  vi.mocked(revalidatePath).mockReset();
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
    expect(revalidateListPages).not.toHaveBeenCalled();
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

  it.each([
    ["rien", undefined],
    ["une chaîne", "La coloc"],
    ["un objet", { name: "La coloc" }],
  ])(
    "refuse un formulaire qui n’en est pas un (%s) sans lever d’exception",
    async (_, formData) => {
      await expect(
        createGroup(formData as unknown as FormData),
      ).resolves.toEqual({ ok: false, error: "UN NOM DE 1 À 30 CARACTÈRES" });
      expect(create).not.toHaveBeenCalled();
      expect(rememberGroup).not.toHaveBeenCalled();
    },
  );

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
    expect(revalidateListPages).not.toHaveBeenCalled();
  });

  it("un groupe dont je ne suis pas membre : refusé, rien n’est écrit", async () => {
    vi.mocked(assertMember).mockRejectedValue(new Error(REFUSED));

    await expect(chooseGroup("g-3")).rejects.toThrow(REFUSED);
    expect(rememberGroup).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
    expect(revalidateGroupPages).not.toHaveBeenCalled();
  });
});

describe("renameGroup", () => {
  it("renomme au nom normalisé et rafraîchit les pages", async () => {
    await expect(renameGroup("g-2", named("  Le   club "))).resolves.toEqual({
      ok: true,
    });

    expect(assertMember).toHaveBeenCalledWith("g-2");
    expect(rename).toHaveBeenCalledWith("g-2", "Le club");
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
  });

  it.each([
    ["un nom vide", named("")],
    ["31 caractères", named("x".repeat(31))],
    ["un formulaire qui n’en est pas un", "Le club"],
  ])("refuse %s sans rien écrire", async (_, formData) => {
    await expect(renameGroup("g-2", formData as FormData)).resolves.toEqual({
      ok: false,
      error: "UN NOM DE 1 À 30 CARACTÈRES",
    });
    expect(rename).not.toHaveBeenCalled();
    expect(revalidateGroupPages).not.toHaveBeenCalled();
  });

  it("un groupe étranger : refusé avant toute validation", () =>
    expectRefusedFirst(() => renameGroup("groupe-b", named("")), [rename]));
});

describe("inviteLink", () => {
  it("donne le lien complet, d’après l’environnement", async () => {
    await expect(inviteLink("g-2")).resolves.toBe(
      `https://we.watch.test/invitation/${TOKEN}`,
    );
    expect(ensureInvite).toHaveBeenCalledWith("g-2");
    expect(regenerateInvite).not.toHaveBeenCalled();
  });

  it("un groupe étranger : refusé avant de lire", () =>
    expectRefusedFirst(() => inviteLink("groupe-b"), [ensureInvite]));
});

describe("regenerateInviteLink", () => {
  it("renvoie le nouveau lien et rafraîchit la page du groupe", async () => {
    await expect(regenerateInviteLink("g-2")).resolves.toBe(
      `https://we.watch.test/invitation/${"B".repeat(43)}`,
    );

    expect(regenerateInvite).toHaveBeenCalledWith("g-2");
    expect(revalidatePath).toHaveBeenCalledWith("/groupe");
  });

  it("un groupe étranger : refusé avant d’écrire", () =>
    expectRefusedFirst(
      () => regenerateInviteLink("groupe-b"),
      [regenerateInvite],
    ));
});

describe("removeMember", () => {
  it("retire un autre membre sans toucher à mon cookie", async () => {
    await removeMember("g-2", "user-2");

    expect(leave).toHaveBeenCalledWith("g-2", "user-2");
    expect(forgetGroup).not.toHaveBeenCalled();
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/groupe");
  });

  it("me retirer moi-même oublie le groupe affiché", async () => {
    await removeMember("g-2", "user-1");

    expect(leave).toHaveBeenCalledWith("g-2", "user-1");
    expect(forgetGroup).toHaveBeenCalledWith("g-2");
  });

  it.each([
    ["vide", ""],
    ["trop long", "x".repeat(65)],
    ["pas une chaîne", 42],
  ])("un identifiant %s : refusé sans rien écrire", async (_, userId) => {
    await expect(removeMember("g-2", userId as string)).rejects.toThrow(
      "invalid userId",
    );
    expect(leave).not.toHaveBeenCalled();
  });

  it("un groupe étranger : refusé avant toute validation", () =>
    expectRefusedFirst(() => removeMember("groupe-b", ""), [leave]));
});

describe("leaveGroup", () => {
  it("me retire, oublie le groupe affiché et rafraîchit", async () => {
    await leaveGroup("g-2");

    expect(leave).toHaveBeenCalledWith("g-2", "user-1");
    expect(forgetGroup).toHaveBeenCalledWith("g-2");
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/groupe");
  });

  it("un groupe étranger : refusé avant d’écrire", () =>
    expectRefusedFirst(() => leaveGroup("groupe-b"), [leave]));
});

describe("joinGroup", () => {
  it("avec un lien valide : rejoint, affiche le groupe et rafraîchit", async () => {
    await expect(joinGroup(TOKEN)).resolves.toEqual({
      ok: true,
      groupId: "g-5",
    });

    expect(findByInvite).toHaveBeenCalledWith(TOKEN);
    expect(join).toHaveBeenCalledWith("g-5", "user-1");
    expect(rememberGroup).toHaveBeenCalledWith("g-5");
    // Joining already marks the group as just used.
    expect(touch).not.toHaveBeenCalled();
    expect(revalidateGroupPages).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/groupe");
  });

  it("déjà membre : bascule quand même sur le groupe", async () => {
    join.mockResolvedValue("already");

    await expect(joinGroup(TOKEN)).resolves.toMatchObject({ ok: true });
    expect(touch).toHaveBeenCalledWith("g-5", "user-1");
  });

  it.each([
    ["un jeton mal formé", "court", 0],
    ["pas une chaîne", 42, 0],
    ["un jeton inconnu", TOKEN, 1],
  ])("%s : lien périmé, sans écrire", async (_, token, lookups) => {
    findByInvite.mockResolvedValue(null);

    await expect(joinGroup(token as string)).resolves.toEqual({
      ok: false,
      error: "CE LIEN N’EST PLUS VALABLE",
    });
    expect(findByInvite).toHaveBeenCalledTimes(lookups);
    expect(join).not.toHaveBeenCalled();
    expect(rememberGroup).not.toHaveBeenCalled();
  });

  it("un groupe supprimé entre-temps : même réponse, sans cookie", async () => {
    join.mockResolvedValue("gone");

    await expect(joinGroup(TOKEN)).resolves.toEqual({
      ok: false,
      error: "CE LIEN N’EST PLUS VALABLE",
    });
    expect(rememberGroup).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
    expect(revalidateGroupPages).not.toHaveBeenCalled();
  });

  it("sans session : refusé avant de résoudre le jeton", async () => {
    vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

    await expect(joinGroup(TOKEN)).rejects.toThrow("not signed in");
    expect(findByInvite).not.toHaveBeenCalled();
  });
});
