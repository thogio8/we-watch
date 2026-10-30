// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/domain/group";
import { type GroupActions, GroupScreen } from "./GroupScreen";
import type { GroupMember } from "./MemberList";

const replace = vi.fn();
const LEA: GroupMember = {
  userId: "u-lea",
  name: "Léa",
  joinedAt: new Date(2026, 9, 23, 20, 0),
};
const HUGO: GroupMember = {
  userId: "u-hugo",
  name: "Hugo",
  joinedAt: new Date(2026, 9, 25, 9, 0),
};
// French typography: non-breaking spaces before « ? » and inside « ».
const REMOVE_HUGO = "RETIRER HUGO DU GROUPE\u00A0?";
const LEAVE_NOUS_DEUX = "QUITTER \u00AB\u00A0NOUS DEUX\u00A0\u00BB\u00A0?";
const NOUS_DEUX: GroupSummary = {
  id: "g-1",
  name: "NOUS DEUX",
  memberCount: 2,
};

let actions: {
  [K in keyof GroupActions]: ReturnType<typeof vi.fn<GroupActions[K]>>;
};

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal("location", { replace });
  actions = {
    rename: vi.fn(() => Promise.resolve({ ok: true } as const)),
    inviteLink: vi.fn(() =>
      Promise.resolve("https://wewatch.test/invitation/a"),
    ),
    regenerateInviteLink: vi.fn(() =>
      Promise.resolve("https://wewatch.test/invitation/b"),
    ),
    removeMember: vi.fn(() => Promise.resolve()),
    leaveGroup: vi.fn(() => Promise.resolve()),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScreen(members: GroupMember[] = [LEA, HUGO]) {
  const user = userEvent.setup();
  render(
    <GroupScreen
      group={{ ...NOUS_DEUX, memberCount: members.length }}
      me={LEA.userId}
      members={members}
      actions={actions}
    />,
  );
  return user;
}

const button = (name: string) => screen.getByRole("button", { name });
const queryButton = (name: string) => screen.queryByRole("button", { name });
const row = (name: string) =>
  screen.getByRole("listitem", { name: new RegExp(name) });

describe("GroupScreen", () => {
  it("affiche le titre et le nom du groupe, renommable", async () => {
    const user = renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: "MEMBRES ET INVITATION" }),
    ).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "NOM DU GROUPE" });
    expect(field).toHaveValue("NOUS DEUX");

    await user.clear(field);
    await user.type(field, "LA COLOC");
    await user.click(button("RENOMMER"));

    expect(actions.rename).toHaveBeenCalledOnce();
    expect(actions.rename.mock.lastCall?.[0].get("name")).toBe("LA COLOC");
  });

  it("un nom invalide affiche l’erreur et n’appelle rien", async () => {
    const user = renderScreen();

    await user.clear(screen.getByRole("textbox", { name: "NOM DU GROUPE" }));
    await user.click(button("RENOMMER"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "UN NOM DE 1 À 30 CARACTÈRES",
    );
    expect(actions.rename).not.toHaveBeenCalled();
  });

  it("un renommage refusé ou en panne affiche un message", async () => {
    actions.rename.mockRejectedValue(new Error("raw text"));
    const user = renderScreen();

    await user.click(button("RENOMMER"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À RENOMMER, RÉESSAIE",
    );
  });

  it("liste les membres : « toi » sur moi, depuis quand, « RETIRER » sur les autres", () => {
    renderScreen();

    const list = screen.getByRole("list", { name: "MEMBRES" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(row("Léa")).toHaveTextContent("toi");
    expect(row("Léa")).toHaveTextContent("depuis le 23/10");
    expect(within(row("Léa")).queryByRole("button")).not.toBeInTheDocument();
    expect(row("Hugo")).not.toHaveTextContent("toi");
    expect(row("Hugo")).toHaveTextContent("depuis le 25/10");
    expect(
      within(row("Hugo")).getByRole("button", { name: "RETIRER" }),
    ).toBeEnabled();
    expect(button("QUITTER LE GROUPE")).toBeEnabled();
  });

  it("retirer passe par une confirmation ; annuler n’appelle rien", async () => {
    const user = renderScreen();

    await user.click(
      within(row("Hugo")).getByRole("button", { name: "RETIRER" }),
    );
    const ticket = screen.getByRole("group", { name: REMOVE_HUGO });
    // Spec §7: the invite link still works for him until regenerated.
    expect(ticket).toHaveAccessibleDescription(
      "HUGO POURRA REVENIR PAR LE LIEN D’INVITATION TANT QU’IL N’EST PAS RÉGÉNÉRÉ.",
    );
    expect(
      within(ticket).getByRole("button", { name: "ANNULER" }),
    ).toHaveFocus();
    await user.click(within(ticket).getByRole("button", { name: "ANNULER" }));

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(actions.removeMember).not.toHaveBeenCalled();
    expect(
      within(row("Hugo")).getByRole("button", { name: "RETIRER" }),
    ).toHaveFocus();
  });

  it("retirer, confirmé, retire ce membre une seule fois", async () => {
    const user = renderScreen();

    await user.click(
      within(row("Hugo")).getByRole("button", { name: "RETIRER" }),
    );
    const ticket = screen.getByRole("group", { name: REMOVE_HUGO });
    await user.dblClick(
      within(ticket).getByRole("button", { name: "RETIRER" }),
    );

    expect(actions.removeMember).toHaveBeenCalledExactlyOnceWith("u-hugo");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("retirer en panne : le message, le ticket reste pour réessayer", async () => {
    actions.removeMember.mockRejectedValue(new Error("raw text"));
    const user = renderScreen();

    await user.click(
      within(row("Hugo")).getByRole("button", { name: "RETIRER" }),
    );
    const ticket = screen.getByRole("group", { name: REMOVE_HUGO });
    await user.click(within(ticket).getByRole("button", { name: "RETIRER" }));

    expect(await within(ticket).findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À RETIRER, RÉESSAIE",
    );
    expect(
      within(ticket).getByRole("button", { name: "RETIRER" }),
    ).toHaveFocus();
  });

  it("quitter passe par une confirmation ; Échap annule sans rien appeler", async () => {
    const user = renderScreen();

    await user.click(button("QUITTER LE GROUPE"));
    const ticket = screen.getByRole("group", { name: LEAVE_NOUS_DEUX });
    expect(ticket).not.toHaveTextContent("DERNIER MEMBRE");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(actions.leaveGroup).not.toHaveBeenCalled();
    expect(button("QUITTER LE GROUPE")).toHaveFocus();
  });

  it("quitter, confirmé, quitte une seule fois puis mène à l’accueil", async () => {
    const user = renderScreen();

    await user.click(button("QUITTER LE GROUPE"));
    await user.dblClick(button("QUITTER"));

    expect(actions.leaveGroup).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    // Stays pending while the app loads.
    expect(button("QUITTER")).toBeDisabled();
  });

  it("dernier membre : quitter annonce la suppression du groupe et de sa liste", async () => {
    const user = renderScreen([LEA]);

    expect(queryButton("RETIRER")).not.toBeInTheDocument();
    await user.click(button("QUITTER LE GROUPE"));

    expect(
      screen.getByRole("group", { name: LEAVE_NOUS_DEUX }),
    ).toHaveAccessibleDescription(
      "TU ES LE DERNIER MEMBRE\u00A0: LE GROUPE ET SA LISTE SERONT SUPPRIMÉS.",
    );
  });

  it("quitter en panne : le message, sans quitter la page", async () => {
    actions.leaveGroup.mockRejectedValue(new Error("raw text"));
    const user = renderScreen();

    await user.click(button("QUITTER LE GROUPE"));
    await user.click(button("QUITTER"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À QUITTER LE GROUPE, RÉESSAIE",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
