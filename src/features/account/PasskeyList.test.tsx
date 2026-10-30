// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountResult, MyPasskey } from "./actions";
import { PasskeyList } from "./PasskeyList";

type Remove = (id: string) => Promise<AccountResult>;

const addPasskey = vi.fn();
const refresh = vi.fn();

vi.mock("@/features/signin/authClient", () => ({
  authClient: {
    passkey: { addPasskey: (...args: unknown[]) => addPasskey(...args) },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const IPHONE: MyPasskey = {
  id: "pk-1",
  name: "iPhone · Safari",
  createdAt: new Date("2026-10-28T19:00:00Z"),
};
const MAC: MyPasskey = { id: "pk-2", name: "CLÉ D’ACCÈS", createdAt: null };
const ADD = "AJOUTER UNE CLÉ D’ACCÈS";
const LAST = "GARDE AU MOINS UNE CLÉ D’ACCÈS";

beforeEach(() => {
  addPasskey.mockReset();
  refresh.mockReset();
  vi.stubGlobal("PublicKeyCredential", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderList(
  passkeys: MyPasskey[] = [IPHONE, MAC],
  answer: Remove = async () => ({ ok: true }),
) {
  const remove = vi.fn(answer);
  render(<PasskeyList passkeys={passkeys} remove={remove} />);
  return { user: userEvent.setup(), remove };
}

const row = (name: string) =>
  screen.getByRole("listitem", { name: new RegExp(name) });

describe("PasskeyList", () => {
  it("liste mes clés, leur appareil et leur date d’ajout", () => {
    renderList();

    expect(
      screen.getByRole("heading", { name: "TES CLÉS D’ACCÈS" }),
    ).toBeVisible();
    expect(row("iPhone · Safari")).toHaveTextContent(
      "ajoutée le 28 octobre 2026",
    );
    expect(row("CLÉ D’ACCÈS")).toBeVisible();
  });

  it("« AJOUTER UNE CLÉ D’ACCÈS » appelle addPasskey une seule fois, puis la liste se recharge", async () => {
    let finish: (value: unknown) => void = () => {};
    addPasskey.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: ADD }));
    await user.click(screen.getByRole("button", { name: ADD }));
    finish({ data: { id: "pk-3" }, error: null });

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(addPasskey).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: ADD })).toBeEnabled();
  });

  it.each([
    ["annulé", () => Promise.resolve({ data: null, error: { code: "X" } })],
    ["en panne", () => Promise.reject(new Error("raw text"))],
  ])("un ajout %s affiche « VALIDATION ANNULÉE »", async (_label, outcome) => {
    addPasskey.mockImplementation(outcome);
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: ADD }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "VALIDATION ANNULÉE, RÉESSAIE",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un navigateur sans clés d’accès voit le message existant à la place d’« AJOUTER »", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    renderList();

    expect(screen.queryByRole("button", { name: ADD })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS.",
    );
  });

  it("supprimer une clé passe par une confirmation", async () => {
    const { user, remove } = renderList();

    await user.click(
      within(row("iPhone · Safari")).getByRole("button", { name: "SUPPRIMER" }),
    );
    expect(remove).not.toHaveBeenCalled();
    const ticket = screen.getByRole("group", {
      name: "SUPPRIMER LA CLÉ «\u00A0IPHONE · SAFARI\u00A0»\u00A0?",
    });
    await user.click(within(ticket).getByRole("button", { name: "SUPPRIMER" }));

    expect(remove).toHaveBeenCalledExactlyOnceWith("pk-1");
    expect(
      screen.getByRole("heading", { name: "TES CLÉS D’ACCÈS" }),
    ).toHaveFocus();
  });

  it("la dernière clé ne se supprime pas : le message de refus à la place", () => {
    renderList([IPHONE]);

    expect(
      within(row("iPhone · Safari")).queryByRole("button", {
        name: "SUPPRIMER",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(LAST)).toBeVisible();
  });

  it("le serveur refuse la dernière (autre onglet) : le refus s’affiche et la liste se recharge", async () => {
    const { user } = renderList([IPHONE, MAC], async () => ({
      ok: false,
      error: LAST,
    }));

    await removeIPhone(user);

    expect(screen.getByRole("alert")).toHaveTextContent(LAST);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("une clé déjà supprimée ailleurs : un message de la DA et la liste se recharge", async () => {
    const { user } = renderList([IPHONE, MAC], () =>
      Promise.reject(new Error("deletePasskey: not found")),
    );

    await removeIPhone(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À SUPPRIMER LA CLÉ, RÉESSAIE",
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
});

/** « SUPPRIMER » on the iPhone's row, then on its ticket. */
async function removeIPhone(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(row("iPhone · Safari")).getByRole("button", { name: "SUPPRIMER" }),
  );
  await user.click(
    within(screen.getByRole("group")).getByRole("button", {
      name: "SUPPRIMER",
    }),
  );
}
