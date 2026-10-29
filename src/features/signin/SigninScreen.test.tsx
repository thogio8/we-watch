// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SigninScreen } from "./SigninScreen";

const signInPasskey = vi.fn();
const addPasskey = vi.fn();
const prepareSignup = vi.fn();
const replace = vi.fn();

vi.mock("./authClient", () => ({
  authClient: {
    signIn: { passkey: (...args: unknown[]) => signInPasskey(...args) },
    passkey: { addPasskey: (...args: unknown[]) => addPasskey(...args) },
  },
}));

const FACE_ID = "SE CONNECTER AVEC FACE ID";
const CREATE = "CRÉER AVEC FACE ID";
const CANCELLED = "FACE ID ANNULÉ, RÉESSAIE";

/** A ceremony that fails: an error object from the client, or a throw. */
const FAILED_CEREMONIES = [
  [
    "annulée",
    () =>
      Promise.resolve({
        data: null,
        error: { code: "ERROR_CEREMONY_ABORTED", message: "raw text" },
      }),
  ],
  ["en panne", () => Promise.reject(new Error("raw text"))],
] as const;

beforeEach(() => {
  signInPasskey.mockReset();
  addPasskey.mockReset();
  prepareSignup.mockReset();
  replace.mockReset();
  vi.stubGlobal("location", { replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScreen(signup: "open" | "invite" = "open") {
  render(<SigninScreen signup={signup} prepareSignup={prepareSignup} />);
  return userEvent.setup();
}

/** Opens the signup form, the way each mode offers it. */
async function openForm(
  user: ReturnType<typeof userEvent.setup>,
  signup: "open" | "invite" = "open",
) {
  const label =
    signup === "open" ? "CRÉER UN COMPTE" : "J’AI UN CODE PROPRIÉTAIRE";
  await user.click(screen.getByRole("button", { name: label }));
}

describe("SigninScreen, accueil", () => {
  it("inscriptions ouvertes : se connecter ou créer un compte", () => {
    renderScreen("open");

    expect(
      screen.getByRole("heading", { name: "ENTRE DANS WEWATCH" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FACE_ID })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "CRÉER UN COMPTE" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("WEWATCH SE REJOINT SUR INVITATION"),
    ).not.toBeInTheDocument();
  });

  it("sur invitation : le message d'invitation, pas de CRÉER UN COMPTE", () => {
    renderScreen("invite");

    expect(
      screen.getByText("WEWATCH SE REJOINT SUR INVITATION"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "CRÉER UN COMPTE" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "J’AI UN CODE PROPRIÉTAIRE" }),
    ).toBeInTheDocument();
  });

  it("se connecter avec Face ID ouvre l'appli", async () => {
    signInPasskey.mockResolvedValue({ data: { session: {} }, error: null });
    const user = renderScreen();

    await user.click(screen.getByRole("button", { name: FACE_ID }));

    expect(signInPasskey).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("sans passkey connue : AUCUN COMPTE SUR CET APPAREIL", async () => {
    signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "PASSKEY_NOT_FOUND", message: "Passkey not found" },
    });
    const user = renderScreen();

    await user.click(screen.getByRole("button", { name: FACE_ID }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AUCUN COMPTE SUR CET APPAREIL",
    );
    expect(screen.getByRole("button", { name: FACE_ID })).toHaveFocus();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(FAILED_CEREMONIES)(
    "une connexion %s affiche FACE ID ANNULÉ, sans le texte brut",
    async (_label, outcome) => {
      signInPasskey.mockImplementation(outcome);
      const user = renderScreen();

      await user.click(screen.getByRole("button", { name: FACE_ID }));

      expect(await screen.findByRole("alert")).toHaveTextContent(CANCELLED);
      expect(screen.queryByText(/raw text/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: FACE_ID })).toBeEnabled();
    },
  );

  it("pendant la cérémonie, les boutons sont désactivés : une seule connexion", async () => {
    signInPasskey.mockReturnValue(new Promise(() => {}));
    const user = renderScreen();
    const faceId = screen.getByRole("button", { name: FACE_ID });

    await user.click(faceId);
    await user.click(faceId);

    expect(signInPasskey).toHaveBeenCalledOnce();
    expect(faceId).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "CRÉER UN COMPTE" }),
    ).toBeDisabled();
  });
});

describe("SigninScreen, création de compte", () => {
  it("CRÉER UN COMPTE ouvre le formulaire sur le prénom, sans code", async () => {
    const user = renderScreen("open");

    await openForm(user, "open");

    const name = screen.getByLabelText("TON PRÉNOM OU SURNOM");
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("autocomplete", "nickname");
    expect(
      screen.queryByLabelText("CODE PROPRIÉTAIRE"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: CREATE })).toBeEnabled();
  });

  it("J’AI UN CODE PROPRIÉTAIRE montre le champ du code", async () => {
    const user = renderScreen("invite");

    await openForm(user, "invite");

    expect(screen.getByLabelText("TON PRÉNOM OU SURNOM")).toHaveFocus();
    expect(screen.getByLabelText("CODE PROPRIÉTAIRE")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("crée la passkey avec le ticket puis ouvre l'appli", async () => {
    prepareSignup.mockResolvedValue({ ok: true, ticket: "le-ticket" });
    addPasskey.mockResolvedValue({ data: { id: "p1" }, error: null });
    const user = renderScreen("invite");
    await openForm(user, "invite");

    await user.type(screen.getByLabelText("TON PRÉNOM OU SURNOM"), "Léa");
    await user.type(screen.getByLabelText("CODE PROPRIÉTAIRE"), "le code");
    await user.click(screen.getByRole("button", { name: CREATE }));

    const formData = prepareSignup.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Léa");
    expect(formData.get("ownerCode")).toBe("le code");
    expect(addPasskey).toHaveBeenCalledWith({
      context: "le-ticket",
      createSession: true,
      name: "WeWatch",
    });
    expect(replace).toHaveBeenCalledWith("/");
  });

  it.each(FAILED_CEREMONIES)(
    "une cérémonie %s : FACE ID ANNULÉ, et le prénom reste",
    async (_label, outcome) => {
      prepareSignup.mockResolvedValue({ ok: true, ticket: "le-ticket" });
      addPasskey.mockImplementation(outcome);
      const user = renderScreen();
      await openForm(user);

      await user.type(screen.getByLabelText("TON PRÉNOM OU SURNOM"), "Léa");
      await user.click(screen.getByRole("button", { name: CREATE }));

      expect(await screen.findByRole("alert")).toHaveTextContent(CANCELLED);
      expect(screen.queryByText(/raw text/)).not.toBeInTheDocument();
      expect(screen.getByLabelText("TON PRÉNOM OU SURNOM")).toHaveValue("Léa");
      expect(screen.getByRole("button", { name: CREATE })).toHaveFocus();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("un refus de prepareSignup s'affiche et aucune passkey n'est créée", async () => {
    prepareSignup.mockResolvedValue({
      ok: false,
      error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    });
    const user = renderScreen();
    await openForm(user);

    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    );
    const name = screen.getByLabelText("TON PRÉNOM OU SURNOM");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
    expect(addPasskey).not.toHaveBeenCalled();
  });

  it("un mauvais code met le champ du code en erreur", async () => {
    prepareSignup.mockResolvedValue({ ok: false, error: "MAUVAIS CODE" });
    const user = renderScreen("invite");
    await openForm(user, "invite");

    await user.type(screen.getByLabelText("TON PRÉNOM OU SURNOM"), "Léa");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(await screen.findByRole("alert")).toHaveTextContent("MAUVAIS CODE");
    const code = screen.getByLabelText("CODE PROPRIÉTAIRE");
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveFocus();
    expect(addPasskey).not.toHaveBeenCalled();
  });

  it.each([
    ["la préparation", false],
    ["Face ID", true],
  ])(
    "pendant %s, CRÉER AVEC FACE ID est désactivé : une seule création",
    async (_label, prepared) => {
      const never = () => new Promise(() => {});
      if (prepared) {
        prepareSignup.mockResolvedValue({ ok: true, ticket: "le-ticket" });
        addPasskey.mockImplementation(never);
      } else {
        prepareSignup.mockImplementation(never);
      }
      const user = renderScreen();
      await openForm(user);
      await user.type(screen.getByLabelText("TON PRÉNOM OU SURNOM"), "Léa");
      const create = screen.getByRole("button", { name: CREATE });

      await user.click(create);
      await user.click(create);

      expect(prepareSignup).toHaveBeenCalledOnce();
      expect(addPasskey).toHaveBeenCalledTimes(prepared ? 1 : 0);
      expect(create).toBeDisabled();
      expect(screen.getByRole("button", { name: "← RETOUR" })).toBeDisabled();
    },
  );

  it("RETOUR revient à l'accueil, sans l'erreur", async () => {
    prepareSignup.mockResolvedValue({ ok: false, error: "MAUVAIS CODE" });
    const user = renderScreen("invite");
    await openForm(user, "invite");
    await user.click(screen.getByRole("button", { name: CREATE }));
    await screen.findByText("MAUVAIS CODE");

    await user.click(screen.getByRole("button", { name: "← RETOUR" }));

    expect(screen.getByRole("button", { name: FACE_ID })).toHaveFocus();
    expect(screen.queryByText("MAUVAIS CODE")).not.toBeInTheDocument();
  });
});
