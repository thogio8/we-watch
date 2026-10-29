// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateGroupResult } from "./actions";
import { CreateGroupForm } from "./CreateGroupForm";

type Create = (formData: FormData) => Promise<CreateGroupResult>;

function renderForm(create: Create = vi.fn<Create>()) {
  const onCreated = vi.fn();
  const user = userEvent.setup();
  render(<CreateGroupForm create={create} onCreated={onCreated} />);
  return { user, create, onCreated };
}

const field = () => screen.getByRole("textbox", { name: "NOM DU GROUPE" });
const submit = () => screen.getByRole("button", { name: "CRÉER LE GROUPE" });

describe("CreateGroupForm", () => {
  it("un nom invalide affiche l’erreur et n’appelle rien", async () => {
    const { user, create, onCreated } = renderForm();

    await user.type(field(), "   ");
    await user.click(submit());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "UN NOM DE 1 À 30 CARACTÈRES",
    );
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("un nom valide envoie le formulaire une fois, puis annonce le groupe créé", async () => {
    const create = vi.fn<Create>(() =>
      Promise.resolve({ ok: true, groupId: "g-9" }),
    );
    const { user, onCreated } = renderForm(create);

    await user.type(field(), "Les potes du jeudi");
    await user.click(submit());

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.lastCall?.[0].get("name")).toBe("Les potes du jeudi");
    expect(onCreated).toHaveBeenCalledExactlyOnceWith("g-9");
  });

  it("un double clic n’appelle create qu’une fois, bouton désactivé pendant l’envoi", async () => {
    const create = vi.fn<Create>(() => new Promise(() => {}));
    const { user } = renderForm(create);

    await user.type(field(), "LA COLOC");
    await user.dblClick(submit());

    expect(create).toHaveBeenCalledOnce();
    expect(submit()).toBeDisabled();
  });

  it("affiche le refus du serveur et laisse réessayer", async () => {
    const create = vi.fn<Create>(() =>
      Promise.resolve({ ok: false, error: "UN NOM DE 1 À 30 CARACTÈRES" }),
    );
    const { user, onCreated } = renderForm(create);

    await user.type(field(), "LA COLOC");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "UN NOM DE 1 À 30 CARACTÈRES",
    );
    expect(submit()).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("une panne affiche un message, sans texte brut, et laisse réessayer", async () => {
    const create = vi
      .fn<Create>()
      .mockRejectedValueOnce(new Error("raw text"))
      .mockResolvedValueOnce({ ok: true, groupId: "g-9" });
    const { user, onCreated } = renderForm(create);

    await user.type(field(), "LA COLOC");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À CRÉER LE GROUPE, RÉESSAIE",
    );
    expect(screen.queryByText("raw text")).not.toBeInTheDocument();

    await user.click(submit());

    expect(onCreated).toHaveBeenCalledExactlyOnceWith("g-9");
  });
});
