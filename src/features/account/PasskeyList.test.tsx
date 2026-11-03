// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeletePasskeyResult } from "./actions";
import type { MyPasskey } from "./load";
import { PasskeyList } from "./PasskeyList";

type Remove = (id: string) => Promise<DeletePasskeyResult>;

const refresh = vi.fn();
const signInPasskey = vi.fn();
const revoke = vi.fn();
const reconfirm = { sessionId: "old-session", revoke };

vi.mock("./AddPasskey", () => ({
  AddPasskey: ({ onAdded }: { onAdded: () => void }) => (
    <button type="button" onClick={onAdded}>
      AJOUTER
    </button>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/signin/authClient", () => ({
  authClient: { signIn: { passkey: () => signInPasskey() } },
}));

const IPHONE: MyPasskey = {
  id: "pk-1",
  name: "iPhone · Safari",
  createdAt: new Date("2026-10-28T19:00:00Z"),
};
const MAC: MyPasskey = { id: "pk-2", name: "CLÉ D’ACCÈS", createdAt: null };
const LAST = "GARDE AU MOINS UNE CLÉ D’ACCÈS";

beforeEach(() => {
  refresh.mockReset();
  signInPasskey.mockReset().mockResolvedValue({ data: {}, error: null });
  revoke.mockReset().mockResolvedValue(true);
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
    <PasskeyList passkeys={passkeys} remove={remove} reconfirm={reconfirm} />,
  );
  if (afterRefresh) {
    refresh.mockImplementation(() =>
      rerender(
        <PasskeyList
          passkeys={afterRefresh}
          remove={remove}
          reconfirm={reconfirm}
        />,
      ),
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
      async () => ({ ok: false, reason: "last" }),
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
      async () => ({ ok: false, reason: "not_found" }),
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

  it("trop d’essais : le refus s’affiche, la liste n’est pas rechargée, le focus sur le titre", async () => {
    const { user } = renderList([IPHONE, MAC], async () => ({
      ok: false,
      reason: "too_many",
    }));

    await removeIPhone(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.",
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(row("iPhone · Safari")).toBeVisible();
    expect(title()).toHaveFocus();
  });

  it("un échec (réseau, base) : le message d’échec dans le ticket, jamais « déjà supprimée », la liste n’est pas rechargée", async () => {
    const { user } = renderList([IPHONE, MAC], () =>
      Promise.reject(new Error("Failed to fetch")),
    );

    await removeIPhone(user);

    const ticket = screen.getByRole("group");
    expect(within(ticket).getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À SUPPRIMER LA CLÉ, RÉESSAIE",
    );
    expect(
      screen.queryByText("CETTE CLÉ N’EXISTE DÉJÀ PLUS"),
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(row("iPhone · Safari")).toBeVisible();
  });

  it("session trop ancienne : la clé d’accès est redemandée, l’ancienne session déconnectée, puis la suppression rejouée sans recliquer", async () => {
    const answers: DeletePasskeyResult[] = [
      { ok: false, reason: "stale" },
      { ok: true },
    ];
    const { user, remove } = renderList([IPHONE, MAC], async () =>
      answers.shift()!,
    );

    await removeIPhone(user);

    expect(signInPasskey).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("old-session");
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith("pk-1");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(title()).toHaveFocus();
  });

  it("session trop ancienne, clé d’accès annulée : « CONFIRME… » dans le ticket, qui reste ouvert, rien n’est rejoué", async () => {
    signInPasskey.mockResolvedValue({ data: null, error: { code: "X" } });
    const { user, remove } = renderList([IPHONE, MAC], async () => ({
      ok: false,
      reason: "stale",
    }));

    await removeIPhone(user);

    const ticket = screen.getByRole("group");
    expect(within(ticket).getByRole("alert")).toHaveTextContent(
      "CONFIRME AVEC TA CLÉ D’ACCÈS POUR CONTINUER",
    );
    expect(remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refusée encore après la clé d’accès : « CONFIRME… » au-dessus de la liste, sans rechargement", async () => {
    const { user } = renderList([IPHONE, MAC], async () => ({
      ok: false,
      reason: "stale",
    }));

    await removeIPhone(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "CONFIRME AVEC TA CLÉ D’ACCÈS POUR CONTINUER",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("une suppression réussie efface le message précédent", async () => {
    const answers = [
      { ok: false, reason: "last" } as const,
      { ok: true } as const,
    ];
    const { user } = renderList([IPHONE, MAC], async () => answers.shift()!);

    await removeIPhone(user);
    expect(screen.getByRole("alert")).toHaveTextContent(LAST);
    await removeIPhone(user);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("une clé ajoutée efface le message précédent", async () => {
    const { user } = renderList([IPHONE, MAC], async () => ({
      ok: false,
      reason: "last",
    }));

    await removeIPhone(user);
    expect(screen.getByRole("alert")).toHaveTextContent(LAST);
    await user.click(screen.getByRole("button", { name: "AJOUTER" }));

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
