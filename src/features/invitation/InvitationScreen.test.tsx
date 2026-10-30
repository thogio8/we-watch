// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JoinGroupResult } from "@/features/groups/actions";
import { type InvitationActions, InvitationScreen } from "./InvitationScreen";
import type { Invitation } from "./load";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/signin/authClient", () => ({ authClient: {} }));

const TOKEN = "A".repeat(43);
const COLOC = "LA COLOC";
const INVITED = "TU ES INVITÉ·E DANS « LA COLOC »";
const ALREADY = "TU ES DÉJÀ DANS « LA COLOC »";

let actions: {
  join: ReturnType<typeof vi.fn<InvitationActions["join"]>>;
  choose: ReturnType<typeof vi.fn<InvitationActions["choose"]>>;
  prepareSignup: ReturnType<typeof vi.fn<InvitationActions["prepareSignup"]>>;
};

beforeEach(() => {
  replace.mockReset();
  actions = {
    join: vi.fn(() => Promise.resolve({ ok: true, groupId: "g-5" } as const)),
    choose: vi.fn(() => Promise.resolve()),
    prepareSignup: vi.fn(),
  };
  vi.stubGlobal("PublicKeyCredential", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScreen(invitation: Invitation) {
  render(
    <InvitationScreen
      invitation={invitation}
      token={TOKEN}
      signup="invite"
      actions={actions}
    />,
  );
  return userEvent.setup();
}

/** A promise settled by hand, to click again while the action runs. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const heading = (name: string) => screen.getByRole("heading", { name });

describe("InvitationScreen", () => {
  it("lien invalide : le dit, et mène à l’accueil", () => {
    renderScreen({ state: "invalid" });

    expect(heading("CE LIEN N’EST PLUS VALABLE")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ALLER À L’ACCUEIL" }),
    ).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("déconnecté : la connexion en variante invitation", () => {
    renderScreen({ state: "signed_out", groupName: COLOC });

    expect(heading(INVITED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SE CONNECTER" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "CRÉER UN COMPTE" }),
    ).toBeEnabled();
  });

  it("pas membre : « REJOINDRE » rejoint une seule fois, puis mène à l’accueil", async () => {
    const answer = deferred<JoinGroupResult>();
    actions.join.mockReturnValue(answer.promise);
    const user = renderScreen({ state: "join", groupName: COLOC });

    expect(heading(INVITED)).toBeInTheDocument();
    await user.dblClick(screen.getByRole("button", { name: "REJOINDRE" }));
    expect(screen.getByRole("button", { name: "REJOINDRE" })).toBeDisabled();
    answer.resolve({ ok: true, groupId: "g-5" });

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(actions.join).toHaveBeenCalledOnce();
  });

  it("pas membre : « PAS MAINTENANT » ramène à l’accueil sans rejoindre", () => {
    renderScreen({ state: "join", groupName: COLOC });

    expect(
      screen.getByRole("link", { name: "PAS MAINTENANT" }),
    ).toHaveAttribute("href", "/");
    expect(actions.join).not.toHaveBeenCalled();
  });

  it("déjà membre : « Y ALLER » choisit le groupe une seule fois, puis mène à l’accueil", async () => {
    const answer = deferred<void>();
    actions.choose.mockReturnValue(answer.promise);
    const user = renderScreen({
      state: "member",
      groupId: "g-5",
      groupName: COLOC,
    });

    expect(heading(ALREADY)).toBeInTheDocument();
    await user.dblClick(screen.getByRole("button", { name: "Y ALLER" }));
    answer.resolve();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(actions.choose).toHaveBeenCalledExactlyOnceWith("g-5");
  });

  it.each([
    [
      "refusé (lien régénéré entre-temps)",
      () =>
        Promise.resolve({
          ok: false as const,
          error: "CE LIEN N’EST PLUS VALABLE",
        }),
      "CE LIEN N’EST PLUS VALABLE",
    ],
    [
      "en panne",
      () => Promise.reject(new Error("raw text")),
      "PAS RÉUSSI À REJOINDRE LE GROUPE, RÉESSAIE",
    ],
  ] as const)(
    "rejoindre %s : le message, et l’on peut réessayer",
    async (_, failure, message) => {
      actions.join.mockImplementation(failure);
      const user = renderScreen({ state: "join", groupName: COLOC });

      await user.click(screen.getByRole("button", { name: "REJOINDRE" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      const retry = screen.getByRole("button", { name: "REJOINDRE" });
      expect(retry).toBeEnabled();
      expect(retry).toHaveFocus();
      expect(replace).not.toHaveBeenCalled();

      await user.click(retry);
      expect(actions.join).toHaveBeenCalledTimes(2);
    },
  );

  it("« Y ALLER » en panne : le message, sans quitter la page", async () => {
    actions.choose.mockRejectedValue(new Error("raw text"));
    const user = renderScreen({
      state: "member",
      groupId: "g-5",
      groupName: COLOC,
    });

    await user.click(screen.getByRole("button", { name: "Y ALLER" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À CHANGER DE GROUPE, RÉESSAIE",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
