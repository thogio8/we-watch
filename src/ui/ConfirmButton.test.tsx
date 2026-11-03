// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { signedOutRefusal } from "@/access/refusals";
import { ConfirmButton } from "./ConfirmButton";

describe("ConfirmButton", () => {
  it("le ticket qui s’ouvre est amené à l’écran, ANNULER prêt", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = userEvent.setup();
    render(
      <ConfirmButton
        label="QUITTER LE GROUPE"
        question="QUITTER ?"
        confirmLabel="QUITTER"
        action={() => Promise.resolve()}
        failure="PAS RÉUSSI"
      />,
    );

    await user.click(screen.getByRole("button", { name: "QUITTER LE GROUPE" }));

    const ticket = screen.getByRole("group", { name: "QUITTER ?" });
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    expect(scroll.mock.contexts[0]).toBe(ticket);
    expect(screen.getByRole("button", { name: "ANNULER" })).toHaveFocus();
  });

  it("une action refusée faute de session (appareil déconnecté ailleurs) : la page de connexion", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    const user = userEvent.setup();
    render(
      <ConfirmButton
        label="QUITTER LE GROUPE"
        question="QUITTER ?"
        confirmLabel="QUITTER"
        action={() => Promise.reject(signedOutRefusal())}
        failure="PAS RÉUSSI"
      />,
    );

    await user.click(screen.getByRole("button", { name: "QUITTER LE GROUPE" }));
    await user.click(screen.getByRole("button", { name: "QUITTER" }));

    expect(replace).toHaveBeenCalledWith("/connexion");
    vi.unstubAllGlobals();
  });
});
