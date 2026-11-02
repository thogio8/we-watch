// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountScreen } from "./AccountScreen";

vi.mock("@/features/signin/authClient", () => ({ authClient: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

beforeEach(() => {
  vi.stubGlobal("PublicKeyCredential", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountScreen", () => {
  it("rassemble prénom, clés, appareils, déconnexion et suppression, sans pastille", () => {
    render(
      <AccountScreen
        name="Léa"
        passkeys={[{ id: "pk-1", name: "iPhone · Safari", createdAt: null }]}
        sessions={[
          {
            id: "s-1",
            device: "iPhone · Safari",
            lastActiveAt: new Date(),
            current: true,
          },
        ]}
        actions={{
          rename: vi.fn(),
          removePasskey: vi.fn(),
          revokeSession: vi.fn(),
          deleteAccount: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "MON COMPTE" }),
    ).toBeVisible();
    expect(screen.getByLabelText("TON PRÉNOM")).toHaveValue("Léa");
    for (const title of ["TES CLÉS D’ACCÈS", "TES APPAREILS"]) {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }
    expect(
      screen.getByRole("button", { name: "SE DÉCONNECTER" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "SUPPRIMER MON COMPTE" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Groupe affiché/ }),
    ).not.toBeInTheDocument();
  });
});
