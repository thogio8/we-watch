// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./SignOutButton";

const signOut = vi.fn();
const replace = vi.fn();

vi.mock("./authClient", () => ({
  authClient: { signOut: (...args: unknown[]) => signOut(...args) },
}));

const LABEL = "SE DÉCONNECTER";

beforeEach(() => {
  signOut.mockReset();
  replace.mockReset();
  vi.stubGlobal("location", { replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const button = () => screen.getByRole("button", { name: LABEL });

describe("SignOutButton", () => {
  it("retourne sur /connexion une fois déconnecté", async () => {
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    render(<SignOutButton />);

    await userEvent.click(button());

    expect(replace).toHaveBeenCalledExactlyOnceWith("/connexion");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [
      "refusée",
      () => Promise.resolve({ data: null, error: { message: "raw text" } }),
    ],
    ["en panne", () => Promise.reject(new Error("raw text"))],
  ])(
    "reste sur place avec une alerte si la déconnexion est %s, et permet de réessayer",
    async (_case, failure) => {
      signOut.mockImplementationOnce(failure);
      render(<SignOutButton />);

      await userEvent.click(button());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "DÉCONNEXION IMPOSSIBLE, RÉESSAIE",
      );
      expect(screen.queryByText("raw text")).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
      expect(button()).toBeEnabled();

      signOut.mockResolvedValueOnce({ data: { success: true }, error: null });
      await userEvent.click(button());

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/connexion"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("n'appelle signOut qu'une fois en cas de double clic", async () => {
    signOut.mockReturnValue(new Promise(() => {}));
    render(<SignOutButton />);
    const user = userEvent.setup();

    await user.dblClick(button());

    expect(signOut).toHaveBeenCalledOnce();
    expect(button()).toBeDisabled();
  });
});
