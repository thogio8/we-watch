// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstGroup } from "./FirstGroup";

vi.mock("@/features/signin/authClient", () => ({
  authClient: { signOut: vi.fn() },
}));

describe("FirstGroup", () => {
  it("invite à créer son premier groupe, et laisse se déconnecter", () => {
    render(<FirstGroup />);

    expect(
      screen.getByRole("heading", { name: "CRÉER TON PREMIER GROUPE" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "SE DÉCONNECTER" }),
    ).toBeVisible();
  });
});
