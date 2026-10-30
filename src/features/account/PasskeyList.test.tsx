// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountResult, MyPasskey } from "./actions";
import { PasskeyList } from "./PasskeyList";

type Remove = (id: string) => Promise<AccountResult>;

const refresh = vi.fn();

vi.mock("./AddPasskey", () => ({ AddPasskey: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const IPHONE: MyPasskey = {
  id: "pk-1",
  name: "iPhone · Safari",
  createdAt: new Date("2026-10-28T19:00:00Z"),
};
const MAC: MyPasskey = { id: "pk-2", name: "CLÉ D’ACCÈS", createdAt: null };
const LAST = "GARDE AU MOINS UNE CLÉ D’ACCÈS";

beforeEach(() => {
  refresh.mockReset();
});

/**
 * My passkeys; `afterRefresh`: what the server sends back once the list is
 * reloaded, rendered as router.refresh() would.
 */
function renderList(
  passkeys: MyPasskey[],
  answer: Remove = async () => ({ ok: true }),
  afterRefresh?: MyPasskey[],
) {
  const remove = vi.fn(answer);
  const { rerender } = render(
    <PasskeyList passkeys={passkeys} remove={remove} />,
  );
  if (afterRefresh) {
    refresh.mockImplementation(() =>
      rerender(<PasskeyList passkeys={afterRefresh} remove={remove} />),
    );
  }
  return { user: userEvent.setup(), remove };
}

const row = (name: string) =>
  screen.getByRole("listitem", { name: new RegExp(name) });
const title = () => screen.getByRole("heading", { name: "TES CLÉS D’ACCÈS" });

describe("PasskeyList", () => {
  it("liste mes clés, leur appareil et leur date d’ajout", () => {
    renderList([IPHONE, MAC]);

    expect(title()).toBeVisible();
    expect(row("iPhone · Safari")).toHaveTextContent(
      "ajoutée le 28 octobre 2026",
    );
    expect(row("CLÉ D’ACCÈS")).toBeVisible();
  });

  it("supprimer une clé passe par une confirmation", async () => {
    const { user, remove } = renderList([IPHONE, MAC]);

    await user.click(
      within(row("iPhone · Safari")).getByRole("button", { name: "SUPPRIMER" }),
    );
    expect(remove).not.toHaveBeenCalled();
    const ticket = screen.getByRole("group", {
      name: "SUPPRIMER LA CLÉ « IPHONE · SAFARI » ?",
    });
    await user.click(within(ticket).getByRole("button", { name: "SUPPRIMER" }));

    expect(remove).toHaveBeenCalledExactlyOnceWith("pk-1");
    expect(title()).toHaveFocus();
  });

  it("la dernière clé ne se supprime pas : le message de refus à la place", () => {
    renderList([IPHONE]);

    expect(
      within(row("iPhone · Safari")).queryByRole("button", {
        name: "SUPPRIMER",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(LAST)).toBeVisible();
  });

  it("le serveur refuse la dernière (autre onglet) : le refus reste affiché après le rechargement, le focus sur le titre", async () => {
    const { user } = renderList(
      [IPHONE, MAC],
      async () => ({ ok: false, error: LAST }),
      [IPHONE],
    );

    await removeIPhone(user);

    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(LAST);
    expect(title()).toHaveFocus();
  });

  it("une clé déjà supprimée ailleurs : le message reste après le rechargement, le focus sur le titre", async () => {
    const { user } = renderList(
      [IPHONE, MAC],
      () => Promise.reject(new Error("deletePasskey: not found")),
      [MAC],
    );

    await removeIPhone(user);

    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("listitem", { name: /iPhone/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "CETTE CLÉ N’EXISTE DÉJÀ PLUS",
    );
    expect(title()).toHaveFocus();
  });

  it("une suppression réussie efface le message précédent", async () => {
    const answers = [
      { ok: false, error: LAST } as const,
      { ok: true } as const,
    ];
    const { user } = renderList([IPHONE, MAC], async () => answers.shift()!);

    await removeIPhone(user);
    expect(screen.getByRole("alert")).toHaveTextContent(LAST);
    await removeIPhone(user);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** « SUPPRIMER » on the iPhone's row, then on its ticket. */
async function removeIPhone(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(row("iPhone · Safari")).getByRole("button", { name: "SUPPRIMER" }),
  );
  await user.click(
    within(screen.getByRole("group")).getByRole("button", {
      name: "SUPPRIMER",
    }),
  );
}
