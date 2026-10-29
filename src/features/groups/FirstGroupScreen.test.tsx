// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateGroupResult } from "./actions";
import { FirstGroupScreen } from "./FirstGroupScreen";
import { GroupPill } from "./GroupPill";

const NOUS_DEUX = { id: "g-1", name: "NOUS DEUX", memberCount: 1 };

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/signin/authClient", () => ({ authClient: {} }));

describe("FirstGroupScreen", () => {
  it("invite à créer son premier groupe, et laisse se déconnecter", () => {
    render(<FirstGroupScreen create={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "CRÉER TON PREMIER GROUPE",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "NOM DU GROUPE" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "SE DÉCONNECTER" }),
    ).toBeVisible();
  });

  it("une fois le groupe créé, rafraîchit la page pour l’afficher", async () => {
    const create = vi.fn<(f: FormData) => Promise<CreateGroupResult>>(() =>
      Promise.resolve({ ok: true, groupId: "g-1" }),
    );
    const user = userEvent.setup();
    render(<FirstGroupScreen create={create} />);

    await user.type(screen.getByRole("textbox"), "NOUS DEUX");
    await user.click(screen.getByRole("button", { name: "CRÉER LE GROUPE" }));

    expect(create).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("le groupe créé, la pastille qui remplace l’écran prend le focus", async () => {
    const create = vi.fn<(f: FormData) => Promise<CreateGroupResult>>(() =>
      Promise.resolve({ ok: true, groupId: "g-1" }),
    );
    const user = userEvent.setup();
    const { unmount } = render(<FirstGroupScreen create={create} />);
    await user.type(screen.getByRole("textbox"), "NOUS DEUX");
    await user.click(screen.getByRole("button", { name: "CRÉER LE GROUPE" }));

    // The refreshed page: the pill above the screen, in place of this one.
    unmount();
    render(
      <GroupPill
        active={NOUS_DEUX}
        groups={[NOUS_DEUX]}
        choose={vi.fn()}
        create={create}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Groupe affiché : NOUS DEUX" }),
    ).toHaveFocus();
  });

  it("une pastille affichée sans création préalable ne vole pas le focus", () => {
    render(
      <GroupPill
        active={NOUS_DEUX}
        groups={[NOUS_DEUX]}
        choose={vi.fn()}
        create={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Groupe affiché : NOUS DEUX" }),
    ).not.toHaveFocus();
  });
});
