import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/server/session";
import { loadInvitation } from "./load";

const findByInvite = vi.fn();
const isMember = vi.fn();
vi.mock("@/server/session");
vi.mock("@/server/container", () => ({
  getGroups: () => ({ findByInvite, isMember }),
}));

const TOKEN = "A".repeat(43);
const COLOC = { id: "g-5", name: "LA COLOC" };

beforeEach(() => {
  findByInvite.mockReset().mockResolvedValue(COLOC);
  isMember.mockReset().mockResolvedValue(false);
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue({
    userId: "user-1",
    name: "Léa",
  });
});

describe("loadInvitation", () => {
  it("déconnecté : le nom du groupe, pour se connecter ou créer un compte", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(loadInvitation(TOKEN)).resolves.toEqual({
      state: "signed_out",
      groupName: "LA COLOC",
    });
    expect(isMember).not.toHaveBeenCalled();
  });

  it("connecté, pas membre : propose de rejoindre", async () => {
    await expect(loadInvitation(TOKEN)).resolves.toEqual({
      state: "join",
      groupName: "LA COLOC",
    });
    expect(findByInvite).toHaveBeenCalledWith(TOKEN);
    expect(isMember).toHaveBeenCalledWith("g-5", "user-1");
  });

  it("déjà membre : le groupe, pour y aller", async () => {
    isMember.mockResolvedValue(true);

    await expect(loadInvitation(TOKEN)).resolves.toEqual({
      state: "member",
      groupId: "g-5",
      groupName: "LA COLOC",
    });
  });

  it.each([
    ["mal formé", "court"],
    ["pas une chaîne", 42],
    ["avec un caractère interdit", `${TOKEN.slice(1)}/`],
  ])(
    "un jeton %s : lien invalide, sans interroger la base",
    async (_, token) => {
      await expect(loadInvitation(token)).resolves.toEqual({
        state: "invalid",
      });
      expect(findByInvite).not.toHaveBeenCalled();
      expect(isMember).not.toHaveBeenCalled();
    },
  );

  it("un jeton régénéré (ou inconnu, ou d’un groupe supprimé) : lien invalide", async () => {
    findByInvite.mockResolvedValue(null);

    await expect(loadInvitation(TOKEN)).resolves.toEqual({ state: "invalid" });
    expect(isMember).not.toHaveBeenCalled();
  });

  it("un lien invalide ne révèle rien, connecté ou non", async () => {
    findByInvite.mockResolvedValue(null);
    const signedIn = await loadInvitation(TOKEN);
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const signedOut = await loadInvitation(TOKEN);
    const malformed = await loadInvitation("court");

    expect(signedOut).toEqual(signedIn);
    expect(malformed).toEqual(signedIn);
  });
});
