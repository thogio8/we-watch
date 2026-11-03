// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountScreen } from "./AccountScreen";

const signInPasskey = vi.fn();

vi.mock("@/features/signin/authClient", () => ({
  authClient: { signIn: { passkey: () => signInPasskey() } },
}));
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

describe("AccountScreen, session trop ancienne", () => {
  it("après la clé d’accès, c’est la session de cet appareil qui est remplacée, pas un autre appareil", async () => {
    signInPasskey.mockResolvedValue({ data: {}, error: null });
    const answers = [
      { ok: false, reason: "stale" } as const,
      { ok: true } as const,
    ];
    const removePasskey = vi.fn(async () => answers.shift()!);
    const revokeSession = vi.fn(async () => true);
    render(
      <AccountScreen
        name="Léa"
        passkeys={[
          { id: "pk-1", name: "iPhone · Safari", createdAt: null },
          { id: "pk-2", name: "YubiKey", createdAt: null },
        ]}
        sessions={[
          {
            id: "s-mac",
            device: "Mac · Chrome",
            lastActiveAt: new Date(),
            current: false,
          },
          {
            id: "s-here",
            device: "iPhone · Safari",
            lastActiveAt: new Date(),
            current: true,
          },
        ]}
        actions={{
          rename: vi.fn(),
          removePasskey,
          revokeSession,
          deleteAccount: vi.fn(),
        }}
      />,
    );
    const user = userEvent.setup();

    const row = screen.getByRole("listitem", { name: /YubiKey/ });
    await user.click(within(row).getByRole("button", { name: "SUPPRIMER" }));
    await user.click(
      within(screen.getByRole("group")).getByRole("button", {
        name: "SUPPRIMER",
      }),
    );

    expect(revokeSession).toHaveBeenCalledExactlyOnceWith("s-here");
    expect(removePasskey).toHaveBeenCalledTimes(2);
  });
});
