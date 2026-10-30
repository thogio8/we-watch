import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findInvitedGroup } from "./invitations";

const findByInvite = vi.fn();
vi.mock("./container", () => ({ getGroups: () => ({ findByInvite }) }));

const TOKEN = "A".repeat(43);
const COLOC = { id: "g-5", name: "LA COLOC" };

beforeEach(() => {
  findByInvite.mockReset().mockResolvedValue(COLOC);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("findInvitedGroup", () => {
  it("un jeton connu : le groupe qu’il ouvre", async () => {
    await expect(findInvitedGroup(TOKEN)).resolves.toEqual(COLOC);
    expect(findByInvite).toHaveBeenCalledWith(TOKEN);
  });

  it("un jeton inconnu ou régénéré : aucun groupe", async () => {
    findByInvite.mockResolvedValue(null);

    await expect(findInvitedGroup(TOKEN)).resolves.toBeNull();
  });

  it.each([
    ["trop court", TOKEN.slice(1)],
    ["trop long", `${TOKEN}A`],
    ["un caractère interdit", `${TOKEN.slice(1)}/`],
    ["vide", ""],
    ["pas une chaîne", 42],
    ["absent", undefined],
  ])(
    "un jeton mal formé (%s) : aucun groupe, sans interroger la base",
    async (_, token) => {
      await expect(findInvitedGroup(token)).resolves.toBeNull();
      expect(findByInvite).not.toHaveBeenCalled();
    },
  );

  it("une base en panne : une erreur sans le jeton ni sa cause, rien dans la console", async () => {
    const logged = (["log", "info", "warn", "error"] as const).map((level) =>
      vi.spyOn(globalThis.console, level).mockImplementation(() => {}),
    );
    findByInvite.mockRejectedValue(
      new Error(`Failed query: select … params: ${TOKEN}`),
    );

    const error = await findInvitedGroup(TOKEN).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(TOKEN);
    expect((error as Error).cause).toBeUndefined();
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });
});
