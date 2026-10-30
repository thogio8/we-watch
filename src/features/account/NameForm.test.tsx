// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccountResult } from "./actions";
import { NameForm } from "./NameForm";

type Rename = (formData: FormData) => Promise<AccountResult>;

function renderForm(answer: Rename = async () => ({ ok: true })) {
  const rename = vi.fn(answer);
  render(<NameForm name="Léa" rename={rename} />);
  return { user: userEvent.setup(), rename };
}

const field = () => screen.getByLabelText("TON PRÉNOM");
const submit = () => screen.getByRole("button", { name: "CHANGER" });

describe("NameForm", () => {
  it("affiche mon prénom, prêt à changer", () => {
    renderForm();

    expect(field()).toHaveValue("Léa");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("un prénom vide est refusé ici, sans aucun appel", async () => {
    const { user, rename } = renderForm();

    await user.clear(field());
    await user.click(submit());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    );
    expect(field()).toHaveFocus();
    expect(rename).not.toHaveBeenCalled();
  });

  it("changé : le nouveau prénom est annoncé, le focus revient sur le bouton", async () => {
    const { user, rename } = renderForm();

    await user.clear(field());
    await user.type(field(), "Nina");
    await user.click(submit());

    expect(rename).toHaveBeenCalledOnce();
    expect(rename.mock.calls[0]?.[0].get("name")).toBe("Nina");
    expect(screen.getByRole("status")).toHaveTextContent(
      "C’EST NOTÉ : TU T’APPELLES NINA",
    );
    expect(submit()).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un refus du serveur s’affiche, rien n’est annoncé", async () => {
    const { user } = renderForm(async () => ({
      ok: false,
      error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    }));

    await user.click(submit());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("une panne affiche un message de la DA, jamais le texte brut", async () => {
    const { user } = renderForm(() => Promise.reject(new Error("raw text")));

    await user.click(submit());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À CHANGER TON PRÉNOM, RÉESSAIE",
    );
  });
});
