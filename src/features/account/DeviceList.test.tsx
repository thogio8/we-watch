// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MySession } from "./actions";
import { DeviceList } from "./DeviceList";

type Revoke = (id: string) => Promise<boolean>;

const refresh = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const HERE: MySession = {
  id: "s-1",
  device: "iPhone · Safari",
  lastActiveAt: new Date("2026-10-30T19:00:00Z"),
  current: true,
};
const MAC: MySession = {
  id: "s-2",
  device: "Mac · Chrome",
  lastActiveAt: new Date("2026-10-29T08:00:00Z"),
  current: false,
};

beforeEach(() => {
  refresh.mockReset();
  replace.mockReset();
  vi.stubGlobal("location", { replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderList(answer: Revoke = async () => true) {
  const revoke = vi.fn(answer);
  const { rerender } = render(
    <DeviceList sessions={[HERE, MAC]} revoke={revoke} />,
  );
  // What router.refresh() brings back: the device gone from the list.
  refresh.mockImplementation(() =>
    rerender(<DeviceList sessions={[HERE]} revoke={revoke} />),
  );
  return { user: userEvent.setup(), revoke };
}

const row = (name: string) =>
  screen.getByRole("listitem", { name: new RegExp(name) });

async function revokeRow(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    within(row(name)).getByRole("button", { name: "DÉCONNECTER" }),
  );
  const ticket = screen.getByRole("group", {
    name: `DÉCONNECTER «\u00A0${name.toUpperCase()}\u00A0»\u00A0?`,
  });
  await user.click(within(ticket).getByRole("button", { name: "DÉCONNECTER" }));
}

describe("DeviceList", () => {
  it("liste mes appareils, leur dernière activité, « CET APPAREIL » sur celui-ci", () => {
    renderList();

    expect(
      screen.getByRole("heading", { name: "TES APPAREILS" }),
    ).toBeVisible();
    expect(row("iPhone · Safari")).toHaveTextContent("CET APPAREIL");
    expect(row("iPhone · Safari")).toHaveTextContent(
      "actif le 30 octobre 2026",
    );
    expect(row("Mac · Chrome")).not.toHaveTextContent("CET APPAREIL");
  });

  it("déconnecter un autre appareil passe par une confirmation, et je reste ici", async () => {
    const { user, revoke } = renderList();

    await user.click(
      within(row("Mac · Chrome")).getByRole("button", { name: "DÉCONNECTER" }),
    );
    expect(revoke).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("group")).getByRole("button", {
        name: "DÉCONNECTER",
      }),
    );

    expect(revoke).toHaveBeenCalledExactlyOnceWith("s-2");
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "TES APPAREILS" }),
    ).toHaveFocus();
  });

  it("déconnecter cet appareil prévient, puis mène à la connexion", async () => {
    const { user, revoke } = renderList();

    await user.click(
      within(row("iPhone · Safari")).getByRole("button", {
        name: "DÉCONNECTER",
      }),
    );
    expect(screen.getByRole("group")).toHaveAccessibleDescription(
      "C’EST CET APPAREIL\u00A0: TU SERAS DÉCONNECTÉ·E ICI.",
    );
    await revokeAgain(user);

    expect(revoke).toHaveBeenCalledExactlyOnceWith("s-1");
    expect(replace).toHaveBeenCalledWith("/connexion");
  });

  it("un appareil déjà déconnecté ailleurs : la liste se recharge, le message reste, le focus sur le titre", async () => {
    const { user } = renderList(async () => false);

    await revokeRow(user, "Mac · Chrome");

    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("listitem", { name: /Mac/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "MAC · CHROME ÉTAIT DÉJÀ DÉCONNECTÉ",
    );
    expect(
      screen.getByRole("heading", { name: "TES APPAREILS" }),
    ).toHaveFocus();
  });

  it("une panne affiche un message de la DA", async () => {
    const { user } = renderList(() => Promise.reject(new Error("raw")));

    await revokeRow(user, "Mac · Chrome");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À DÉCONNECTER L’APPAREIL, RÉESSAIE",
    );
  });
});

async function revokeAgain(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(screen.getByRole("group")).getByRole("button", {
      name: "DÉCONNECTER",
    }),
  );
}
