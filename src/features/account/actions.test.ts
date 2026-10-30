import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSignedIn } from "@/server/session";
import { deletePasskey, listMyPasskeys } from "./actions";

const passkeysOf = vi.fn();
const remove = vi.fn();

vi.mock("@/server/session");
vi.mock("next/cache");
vi.mock("@/server/container", () => ({
  getAccount: () => ({ passkeysOf, deletePasskey: remove }),
}));

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
const T0 = new Date(2026, 9, 1);

beforeEach(() => {
  vi.mocked(assertSignedIn).mockReset().mockResolvedValue(LEA);
  vi.mocked(revalidatePath).mockReset();
  passkeysOf.mockReset().mockResolvedValue([]);
  remove.mockReset().mockResolvedValue("deleted");
});

const signedOut = () =>
  vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

describe("listMyPasskeys", () => {
  it("donne mes passkeys ; sans nom, « CLÉ D’ACCÈS »", async () => {
    passkeysOf.mockResolvedValue([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: null, createdAt: null },
    ]);

    await expect(listMyPasskeys()).resolves.toEqual([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: "CLÉ D’ACCÈS", createdAt: null },
    ]);
    expect(passkeysOf).toHaveBeenCalledWith("user-1");
  });

  it("sans session : refuse sans rien lire", async () => {
    signedOut();

    await expect(listMyPasskeys()).rejects.toThrow("not signed in");
    expect(passkeysOf).not.toHaveBeenCalled();
  });
});

describe("deletePasskey", () => {
  it("supprime la mienne et rafraîchit « MON COMPTE »", async () => {
    await expect(deletePasskey("p-1")).resolves.toEqual({ ok: true });

    expect(remove).toHaveBeenCalledWith("user-1", "p-1");
    expect(revalidatePath).toHaveBeenCalledWith("/compte");
  });

  it("la dernière : refusée avec le message, rien à rafraîchir", async () => {
    remove.mockResolvedValue("last");

    await expect(deletePasskey("p-1")).resolves.toEqual({
      ok: false,
      error: "GARDE AU MOINS UNE CLÉ D’ACCÈS",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("celle d’un autre ou une inconnue : lève une exception", async () => {
    remove.mockResolvedValue("not_found");

    await expect(deletePasskey("p-9")).rejects.toThrow(
      "deletePasskey: not found",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["vide", ""],
    ["trop long", "x".repeat(65)],
    ["un nombre", 42],
    ["absent", undefined],
  ])("un id %s est refusé avant toute écriture", async (_, id) => {
    await expect(deletePasskey(id as string)).rejects.toThrow(
      "deletePasskey: invalid id",
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("sans session : refuse sans rien supprimer", async () => {
    signedOut();

    await expect(deletePasskey("p-1")).rejects.toThrow("not signed in");
    expect(remove).not.toHaveBeenCalled();
  });
});
