// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountResult } from "./actions";
import { DeleteAccount } from "./DeleteAccount";

type Remove = (formData: FormData) => Promise<AccountResult>;

const replace = vi.fn();
const QUESTION = "SUPPRIMER TON COMPTE\u00A0?";
const CONFIRM = "SUPPRIMER DÉFINITIVEMENT";

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal("location", { replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openTicket(answer: Remove = async () => ({ ok: true })) {
  const remove = vi.fn(answer);
  const user = userEvent.setup();
  render(<DeleteAccount name="Léa" remove={remove} />);
  await user.click(
    screen.getByRole("button", { name: "SUPPRIMER MON COMPTE" }),
  );
  return { user, remove };
}

const confirm = () => screen.getByRole("button", { name: CONFIRM });
const typed = () => screen.getByLabelText("TAPE « Léa » POUR CONFIRMER");

describe("DeleteAccount", () => {
  it("demande une confirmation forte : le bouton reste inactif tant que le prénom n’est pas exact", async () => {
    const { user, remove } = await openTicket();

    expect(screen.getByRole("group", { name: QUESTION })).toBeVisible();
    expect(confirm()).toBeDisabled();
    await user.type(typed(), "Lé");
    expect(confirm()).toBeDisabled();
    await user.type(typed(), "A");
    expect(confirm()).toBeDisabled();
    await user.clear(typed());
    await user.type(typed(), "Léa");
    expect(confirm()).toBeEnabled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("le clavier du téléphone ne change pas la casse du prénom tapé", async () => {
    await openTicket();

    expect(typed()).toHaveAttribute("autocapitalize", "none");
  });

  it("le prénom exact puis « SUPPRIMER DÉFINITIVEMENT » : le compte part, puis la connexion", async () => {
    const { user, remove } = await openTicket();

    await user.type(typed(), "Léa");
    await user.click(confirm());

    expect(remove).toHaveBeenCalledOnce();
    expect(remove.mock.calls[0]?.[0].get("name")).toBe("Léa");
    expect(replace).toHaveBeenCalledWith("/connexion");
  });

  it("annuler n’appelle rien et rend le bouton", async () => {
    const { user, remove } = await openTicket();

    await user.type(typed(), "Léa");
    await user.click(screen.getByRole("button", { name: "ANNULER" }));

    expect(remove).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "SUPPRIMER MON COMPTE" }),
    ).toHaveFocus();
  });

  it("rouvrir après avoir annulé : champ vide, bouton inactif", async () => {
    const { user } = await openTicket();

    await user.type(typed(), "Léa");
    await user.click(screen.getByRole("button", { name: "ANNULER" }));
    await user.click(
      screen.getByRole("button", { name: "SUPPRIMER MON COMPTE" }),
    );

    expect(typed()).toHaveValue("");
    expect(confirm()).toBeDisabled();
  });

  it.each([
    ["un prénom refusé", "TAPE TON PRÉNOM EXACT"],
    ["trop d’essais", "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT."],
  ])(
    "un refus du serveur (%s) s’affiche, sans quitter la page",
    async (_, error) => {
      const { user } = await openTicket(async () => ({ ok: false, error }));

      await user.type(typed(), "Léa");
      await user.click(confirm());

      expect(screen.getByRole("alert")).toHaveTextContent(error);
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("une panne affiche un message de la DA", async () => {
    const { user } = await openTicket(() => Promise.reject(new Error("raw")));

    await user.type(typed(), "Léa");
    await user.click(confirm());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À SUPPRIMER TON COMPTE, RÉESSAIE",
    );
  });
});
