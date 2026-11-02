import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withinLimit } from "@/server/rate-limit";
import { revalidateListPages } from "@/server/revalidate";
import { assertSignedIn } from "@/server/session";
import { signOutThisDevice } from "@/server/sign-out";
import { expectLimitedFirst } from "../../../tests/helpers/limited";
import {
  deleteAccount,
  deletePasskey,
  renameMe,
  revokeSession,
} from "./actions";

const remove = vi.fn();
const deleteSession = vi.fn();
const deleteUser = vi.fn();
const updateUser = vi.fn();

vi.mock("@/server/session");
vi.mock("@/server/revalidate");
vi.mock("@/server/rate-limit");
vi.mock("@/server/sign-out", () => ({ signOutThisDevice: vi.fn() }));
vi.mock("next/cache");
vi.mock("next/headers");
vi.mock("@/server/container", () => ({
  getAccount: () => ({
    deletePasskey: remove,
    deleteSession,
    deleteUser,
  }),
  getAuth: () => ({ api: { updateUser } }),
}));

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
const TOO_MANY = {
  ok: false,
  error: "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.",
};

beforeEach(() => {
  vi.mocked(assertSignedIn).mockReset().mockResolvedValue(LEA);
  vi.mocked(revalidatePath).mockReset();
  remove.mockReset().mockResolvedValue("deleted");
  deleteSession.mockReset().mockResolvedValue(true);
  deleteUser.mockReset().mockResolvedValue(true);
  updateUser.mockReset().mockResolvedValue({ status: true });
  vi.mocked(revalidateListPages).mockReset();
  vi.mocked(signOutThisDevice).mockReset();
  vi.mocked(withinLimit).mockClear();
});

const aForm = (name: unknown) => {
  const form = new FormData();
  if (typeof name === "string") form.set("name", name);
  return form;
};

const signedOut = () =>
  vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

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

  it("trop d’essais : « too_many » après la session, avant de valider l’id, sans rien supprimer", () =>
    expectLimitedFirst(() => deletePasskey(""), {
      limit: "delete-passkey",
      subject: "user-1",
      refusal: { ok: false, reason: "too_many" },
      untouched: [remove, vi.mocked(revalidatePath)],
    }));
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

  it("trop d’essais : refusé après la session, avant de lire le prénom, sans rien écrire", () =>
    expectLimitedFirst(() => renameMe(aForm("")), {
      limit: "rename-me",
      subject: "user-1",
      refusal: TOO_MANY,
      untouched: [updateUser, vi.mocked(revalidateListPages)],
    }));
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

  it("trop d’essais : refusé après la session, même avec le bon prénom, sans rien supprimer", () =>
    expectLimitedFirst(() => deleteAccount(aForm("Léa")), {
      limit: "delete-account",
      subject: "user-1",
      refusal: TOO_MANY,
      untouched: [deleteUser, vi.mocked(signOutThisDevice)],
    }));

  it("un prénom faux compte aussi une tentative", async () => {
    await deleteAccount(aForm("Hugo"));

    expect(withinLimit).toHaveBeenCalledExactlyOnceWith(
      "delete-account",
      "user-1",
    );
  });
});
