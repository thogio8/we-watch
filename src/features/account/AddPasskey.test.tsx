// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddPasskey } from "./AddPasskey";

const addPasskey = vi.fn();
const signInPasskey = vi.fn();
const refresh = vi.fn();
const revoke = vi.fn();

vi.mock("@/features/signin/authClient", () => ({
  authClient: {
    passkey: { addPasskey: (...args: unknown[]) => addPasskey(...args) },
    signIn: { passkey: () => signInPasskey() },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ADD = "AJOUTER UNE CLÉ D’ACCÈS";
const onAdded = vi.fn();

beforeEach(() => {
  addPasskey.mockReset();
  signInPasskey.mockReset().mockResolvedValue({ data: {}, error: null });
  revoke.mockReset().mockResolvedValue(true);
  refresh.mockReset();
  onAdded.mockReset();
  vi.stubGlobal("PublicKeyCredential", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAdd() {
  render(
    <AddPasskey
      onAdded={onAdded}
      reconfirm={{ sessionId: "old-session", revoke }}
    />,
  );
  return userEvent.setup();
}

describe("AddPasskey", () => {
  it("appelle addPasskey une seule fois, annonce « CLÉ AJOUTÉE », le dit à la liste, puis elle se recharge", async () => {
    let finish: (value: unknown) => void = () => {};
    addPasskey.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));
    await user.click(screen.getByRole("button", { name: ADD }));
    finish({ data: { id: "pk-3" }, error: null });

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(addPasskey).toHaveBeenCalledOnce();
    expect(onAdded).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("CLÉ AJOUTÉE");
    expect(screen.getByRole("button", { name: ADD })).toBeEnabled();
  });

  it.each([
    ["annulé", () => Promise.resolve({ data: null, error: { code: "X" } })],
    ["en panne", () => Promise.reject(new Error("raw text"))],
  ])("un ajout %s affiche « VALIDATION ANNULÉE »", async (_label, outcome) => {
    addPasskey.mockImplementation(outcome);
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "VALIDATION ANNULÉE, RÉESSAIE",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(refresh).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("cet appareil a déjà une clé : il le dit", async () => {
    addPasskey.mockResolvedValue({
      data: null,
      error: { code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" },
    });
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CET APPAREIL A DÉJÀ UNE CLÉ D’ACCÈS",
    );
  });

  it("trop d’essais (429) : il le dit", async () => {
    addPasskey.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests." },
    });
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.",
    );
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("session trop ancienne (403) : la clé d’accès est redemandée, l’ancienne session déconnectée, puis la clé ajoutée sans recliquer", async () => {
    addPasskey
      .mockResolvedValueOnce({
        data: null,
        error: { status: 403, code: "SESSION_NOT_FRESH" },
      })
      .mockResolvedValueOnce({ data: { id: "pk-3" }, error: null });
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(signInPasskey).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("old-session");
    expect(addPasskey).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("CLÉ AJOUTÉE");
  });

  it("session trop ancienne, clé d’accès annulée : « CONFIRME… », rien n’est rejoué", async () => {
    addPasskey.mockResolvedValue({
      data: null,
      error: { status: 403, code: "SESSION_NOT_FRESH" },
    });
    signInPasskey.mockResolvedValue({ data: null, error: { code: "X" } });
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CONFIRME AVEC TA CLÉ D’ACCÈS POUR CONTINUER",
    );
    expect(addPasskey).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("session trop ancienne, la déconnexion de l’ancienne échoue : « VALIDATION ANNULÉE »", async () => {
    addPasskey.mockResolvedValue({
      data: null,
      error: { status: 403, code: "SESSION_NOT_FRESH" },
    });
    revoke.mockRejectedValue(new Error("Failed to fetch"));
    const user = renderAdd();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "VALIDATION ANNULÉE, RÉESSAIE",
    );
    expect(screen.getByRole("button", { name: ADD })).toBeEnabled();
  });

  it("un navigateur sans clés d’accès voit le message existant à la place d’« AJOUTER »", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    renderAdd();

    expect(screen.queryByRole("button", { name: ADD })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS.",
    );
  });
});
