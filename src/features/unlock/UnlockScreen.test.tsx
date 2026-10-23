// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnlockScreen } from "./UnlockScreen";

const unlock = vi.fn();

vi.mock("./actions", () => ({
  unlock: (...args: unknown[]) => unlock(...args),
}));

afterEach(cleanup);

describe("UnlockScreen", () => {
  it("demande le code dans un champ masqué", () => {
    render(<UnlockScreen />);

    expect(
      screen.getByRole("heading", { name: "CE SOIR ON REGARDE" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ENTREZ LE CODE" }),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("Code d'accès");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("button", { name: "ENTRER" })).toBeEnabled();
  });

  it("affiche MAUVAIS CODE et vide le champ après un échec", async () => {
    unlock.mockResolvedValue({ error: "MAUVAIS CODE" });
    const user = userEvent.setup();
    render(<UnlockScreen />);

    await user.type(screen.getByLabelText("Code d'accès"), "faux");
    await user.click(screen.getByRole("button", { name: "ENTRER" }));

    expect(await screen.findByText("MAUVAIS CODE")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByLabelText("Code d'accès")).toHaveValue("");
    expect(screen.getByLabelText("Code d'accès")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const formData = unlock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("code")).toBe("faux");
  });
});
