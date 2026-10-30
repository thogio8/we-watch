import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateListPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { signOutThisDevice } from "@/server/sign-out";
import {
  deleteAccount,
  deletePasskey,
  listMyPasskeys,
  listMySessions,
  renameMe,
  revokeSession,
} from "./actions";

const passkeysOf = vi.fn();
const remove = vi.fn();
const sessionsOf = vi.fn();
const deleteSession = vi.fn();
const deleteUser = vi.fn();
const updateUser = vi.fn();

vi.mock("@/server/session");
vi.mock("@/server/revalidate");
vi.mock("@/server/sign-out", () => ({ signOutThisDevice: vi.fn() }));
vi.mock("next/cache");
vi.mock("next/headers");
vi.mock("@/server/container", () => ({
  getAccount: () => ({
    passkeysOf,
    deletePasskey: remove,
    sessionsOf,
    deleteSession,
    deleteUser,
  }),
  getAuth: () => ({ api: { updateUser } }),
}));

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
const T0 = new Date(2026, 9, 1);

beforeEach(() => {
  vi.mocked(assertSignedIn).mockReset().mockResolvedValue(LEA);
  vi.mocked(revalidatePath).mockReset();
  passkeysOf.mockReset().mockResolvedValue([]);
  remove.mockReset().mockResolvedValue("deleted");
  sessionsOf.mockReset().mockResolvedValue([]);
  deleteSession.mockReset().mockResolvedValue(true);
  deleteUser.mockReset().mockResolvedValue(true);
  updateUser.mockReset().mockResolvedValue({ status: true });
  vi.mocked(revalidateListPages).mockReset();
  vi.mocked(signOutThisDevice).mockReset();
});

const aForm = (name: unknown) => {
  const form = new FormData();
  if (typeof name === "string") form.set("name", name);
  return form;
};

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

  it("la dernière : refusée (« last »), rien à rafraîchir", async () => {
    remove.mockResolvedValue("last");

    await expect(deletePasskey("p-1")).resolves.toEqual({
      ok: false,
      reason: "last",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("celle d’un autre ou une inconnue : refusée (« not_found »), rien à rafraîchir", async () => {
    remove.mockResolvedValue("not_found");

    await expect(deletePasskey("p-9")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
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

describe("listMySessions", () => {
  it("donne mes appareils, nommés d’après leur navigateur, sans jeton ; « CET APPAREIL » pour le mien", async () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    sessionsOf.mockResolvedValue([
      { id: "session-1", userAgent: iphone, updatedAt: T0 },
      { id: "session-2", userAgent: null, updatedAt: T0 },
    ]);

    await expect(listMySessions()).resolves.toEqual([
      {
        id: "session-1",
        device: "iPhone · Safari",
        lastActiveAt: T0,
        current: true,
      },
      {
        id: "session-2",
        device: "APPAREIL INCONNU",
        lastActiveAt: T0,
        current: false,
      },
    ]);
    expect(sessionsOf).toHaveBeenCalledWith("user-1");
  });

  it("sans session : refuse sans rien lire", async () => {
    signedOut();

    await expect(listMySessions()).rejects.toThrow("not signed in");
    expect(sessionsOf).not.toHaveBeenCalled();
  });
});

describe("revokeSession", () => {
  it("un autre appareil à moi : supprimé, cet appareil reste connecté", async () => {
    await expect(revokeSession("session-2")).resolves.toBe(true);

    expect(deleteSession).toHaveBeenCalledWith("user-1", "session-2");
    expect(signOutThisDevice).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/compte");
  });

  it("cet appareil : supprimé, et ses cookies effacés (déconnexion)", async () => {
    await expect(revokeSession("session-1")).resolves.toBe(true);

    expect(deleteSession).toHaveBeenCalledWith("user-1", "session-1");
    expect(signOutThisDevice).toHaveBeenCalledOnce();
  });

  it("celle d’un autre ou une inconnue : false, rien d’autre", async () => {
    deleteSession.mockResolvedValue(false);

    await expect(revokeSession("session-9")).resolves.toBe(false);
    expect(signOutThisDevice).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["vide", ""],
    ["trop long", "x".repeat(65)],
    ["un objet", {}],
  ])("un id %s est refusé avant toute écriture", async (_, id) => {
    await expect(revokeSession(id as string)).rejects.toThrow(
      "revokeSession: invalid id",
    );
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("sans session : refuse sans rien supprimer", async () => {
    signedOut();

    await expect(revokeSession("session-1")).rejects.toThrow("not signed in");
    expect(deleteSession).not.toHaveBeenCalled();
  });
});

describe("renameMe", () => {
  it("change mon prénom par Better Auth (session de la requête) et rafraîchit les listes", async () => {
    const requestHeaders = new Headers({ cookie: "x=y" });
    vi.mocked(headers).mockResolvedValueOnce(requestHeaders as never);

    await expect(renameMe(aForm("  Zoé  "))).resolves.toEqual({ ok: true });

    expect(updateUser).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: { name: "Zoé" },
    });
    expect(revalidateListPages).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/compte");
  });

  it.each([
    ["vide", aForm("   ")],
    ["trop long", aForm("x".repeat(31))],
    ["absent", aForm(undefined)],
    ["pas un formulaire", "Zoé"],
  ])(
    "un prénom %s est refusé avec le message, rien n’est écrit",
    async (_, form) => {
      await expect(renameMe(form as FormData)).resolves.toEqual({
        ok: false,
        error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
      });
      expect(updateUser).not.toHaveBeenCalled();
      expect(revalidateListPages).not.toHaveBeenCalled();
    },
  );

  it("sans session : refuse sans rien écrire", async () => {
    signedOut();

    await expect(renameMe(aForm("Zoé"))).rejects.toThrow("not signed in");
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  it("mon prénom exact : supprime mon compte, efface les cookies de cet appareil et rafraîchit les listes", async () => {
    await expect(deleteAccount(aForm(" Léa "))).resolves.toEqual({ ok: true });

    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(signOutThisDevice).toHaveBeenCalledOnce();
    expect(revalidateListPages).toHaveBeenCalled();
  });

  it.each([
    ["avec une espace doublée", "Jean Pierre", "Jean  Pierre"],
    ["avec l’apostrophe du téléphone", "D'Artagnan", "D\u2019Artagnan"],
    ["avec l’apostrophe droite", "D\u2019Artagnan", "D'Artagnan"],
  ])("mon prénom tapé %s confirme la suppression", async (_, name, typed) => {
    vi.mocked(assertSignedIn).mockResolvedValue({ ...LEA, name });

    await expect(deleteAccount(aForm(typed))).resolves.toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it.each([
    ["un autre prénom", aForm("Hugo")],
    ["la casse changée", aForm("léa")],
    ["vide", aForm("")],
    ["absent", aForm(undefined)],
    ["pas un formulaire", "Léa"],
  ])("%s : refus avec le message, rien n’est écrit", async (_, form) => {
    await expect(deleteAccount(form as FormData)).resolves.toEqual({
      ok: false,
      error: "TAPE TON PRÉNOM EXACT",
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOutThisDevice).not.toHaveBeenCalled();
  });

  it("sans session : refuse sans rien supprimer", async () => {
    signedOut();

    await expect(deleteAccount(aForm("Léa"))).rejects.toThrow("not signed in");
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
