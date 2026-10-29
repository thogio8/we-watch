// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateGroupResult } from "./actions";
import { FirstGroupScreen } from "./FirstGroupScreen";

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
});
