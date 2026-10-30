// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/domain/group";
import type { CreateGroupResult } from "./actions";
import { GroupPill } from "./GroupPill";

vi.mock("@/features/signin/authClient", () => ({ authClient: {} }));

type Choose = (groupId: string) => Promise<void>;
type Create = (formData: FormData) => Promise<CreateGroupResult>;

const NOUS_DEUX: GroupSummary = {
  id: "nous-deux",
  name: "NOUS DEUX",
  memberCount: 2,
};
const JEUDI: GroupSummary = {
  id: "g-2",
  name: "LES POTES DU JEUDI",
  memberCount: 1,
};

function renderPill({
  choose = vi.fn<Choose>(() => Promise.resolve()),
  create = vi.fn<Create>(() => Promise.resolve({ ok: true, groupId: "g-3" })),
}: { choose?: Choose; create?: Create } = {}) {
  const user = userEvent.setup();
  render(
    <>
      <GroupPill
        active={NOUS_DEUX}
        groups={[NOUS_DEUX, JEUDI]}
        choose={choose}
        create={create}
      />
      <p>Le reste de l’écran</p>
      <a href="#suite">la suite</a>
    </>,
  );
  return { user, choose, create };
}

const pill = () =>
  screen.getByRole("button", { name: "Groupe affiché : NOUS DEUX" });
const panel = () => screen.getByRole("dialog", { name: "TES GROUPES" });
const queryPanel = () => screen.queryByRole("dialog");

describe("GroupPill", () => {
  it("affiche le groupe actif, panneau fermé", () => {
    renderPill();

    expect(pill()).toHaveTextContent("NOUS DEUX");
    expect(pill()).toHaveAttribute("aria-expanded", "false");
    expect(queryPanel()).not.toBeInTheDocument();
  });

  it("ouvre un panneau qui liste les groupes, leurs membres et le ✓ de l’actif", async () => {
    const { user } = renderPill();

    await user.click(pill());

    expect(pill()).toHaveAttribute("aria-expanded", "true");
    expect(pill()).toHaveAttribute("aria-controls", panel().id);
    const active = within(panel()).getByRole("button", { name: /NOUS DEUX/ });
    expect(active).toHaveTextContent("2 MEMBRES ✓");
    expect(active).toHaveAttribute("aria-current", "true");
    const other = within(panel()).getByRole("button", { name: /JEUDI/ });
    expect(other).toHaveTextContent("1 MEMBRE");
    expect(other).not.toHaveTextContent("✓");
    expect(active).toHaveFocus();
  });

  it("choisir un autre groupe appelle choose une seule fois et ferme", async () => {
    const { user, choose } = renderPill();

    await user.click(pill());
    await user.dblClick(within(panel()).getByRole("button", { name: /JEUDI/ }));

    expect(choose).toHaveBeenCalledExactlyOnceWith("g-2");
    expect(queryPanel()).not.toBeInTheDocument();
  });

  it("choisir le groupe déjà affiché ferme le panneau sans rien appeler", async () => {
    const { user, choose } = renderPill();

    await user.click(pill());
    await user.click(
      within(panel()).getByRole("button", { name: /NOUS DEUX/ }),
    );

    expect(choose).not.toHaveBeenCalled();
    expect(queryPanel()).not.toBeInTheDocument();
    expect(pill()).toHaveFocus();
  });

  it("un échec du changement de groupe s’affiche et laisse le panneau ouvert", async () => {
    const choose = vi.fn<Choose>(() => Promise.reject(new Error("raw text")));
    const { user } = renderPill({ choose });

    await user.click(pill());
    await user.click(within(panel()).getByRole("button", { name: /JEUDI/ }));

    expect(await within(panel()).findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À CHANGER DE GROUPE, RÉESSAIE",
    );
  });

  it("« + CRÉER UN GROUPE » déplie le formulaire ; un nom invalide n’appelle rien", async () => {
    const { user, create } = renderPill();

    await user.click(pill());
    const toggle = within(panel()).getByRole("button", {
      name: "+ CRÉER UN GROUPE",
    });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "CRÉER LE GROUPE" }));

    expect(within(panel()).getByRole("alert")).toHaveTextContent(
      "UN NOM DE 1 À 30 CARACTÈRES",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("créer un groupe appelle create une fois et ferme le panneau", async () => {
    const { user, create } = renderPill();

    await user.click(pill());
    await user.click(screen.getByRole("button", { name: "+ CRÉER UN GROUPE" }));
    await user.type(
      screen.getByRole("textbox", { name: "NOM DU GROUPE" }),
      "LA COLOC",
    );
    await user.dblClick(
      screen.getByRole("button", { name: "CRÉER LE GROUPE" }),
    );

    expect(create).toHaveBeenCalledOnce();
    expect(queryPanel()).not.toBeInTheDocument();
  });

  it("Échap ferme le panneau et rend le focus à la pastille", async () => {
    const { user } = renderPill();

    await user.click(pill());
    await user.keyboard("{Escape}");

    expect(queryPanel()).not.toBeInTheDocument();
    expect(pill()).toHaveFocus();
  });

  it("toucher à côté (le voile) ferme le panneau et rend le focus à la pastille", async () => {
    const { user } = renderPill();

    await user.click(pill());
    // iOS only sends the tap to a clickable element: the scrim itself closes.
    await user.click(screen.getByTestId("group-scrim"));

    expect(queryPanel()).not.toBeInTheDocument();
    expect(pill()).toHaveFocus();
  });

  it("sortir du panneau au clavier le referme", async () => {
    const { user } = renderPill();

    await user.click(pill());
    // ✓ NOUS DEUX → JEUDI → + CRÉER → MEMBRES → SE DÉCONNECTER → out.
    for (let step = 0; step < 5; step += 1) await user.tab();

    expect(queryPanel()).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "la suite" })).toHaveFocus();
  });

  it("« SE DÉCONNECTER » est dans le panneau", async () => {
    const { user } = renderPill();

    await user.click(pill());

    expect(
      within(panel()).getByRole("button", { name: "SE DÉCONNECTER" }),
    ).toBeVisible();
  });

  it("« MEMBRES ET INVITATION » mène à /groupe et ferme le panneau", async () => {
    const { user } = renderPill();

    await user.click(pill());
    const members = within(panel()).getByRole("link", {
      name: "MEMBRES ET INVITATION",
    });
    expect(members).toHaveAttribute("href", "/groupe");
    await user.click(members);

    expect(queryPanel()).not.toBeInTheDocument();
  });
});
